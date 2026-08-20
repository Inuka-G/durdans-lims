package com.uom.lims.whatsapp.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.uom.lims.whatsapp.domain.MessageDirection;
import com.uom.lims.whatsapp.domain.WaMessageEntity;
import com.uom.lims.whatsapp.domain.WaMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The text agent: conversation history in, one WhatsApp-sized answer out, with catalogue
 * facts fetched through tools rather than composed by the model.
 *
 * <p>Principle 3 of the design doc governs the shape of this class. The system prompt
 * asks the model to behave; the tool layer is what makes the numbers true — a price the
 * model states either came out of {@link CoreCatalogClient} verbatim JSON or the prompt
 * has failed, and the prompt failing is why the rules also live server-side in the core
 * (role-scoped endpoints, no clinical data on the agent path at all).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentOrchestrator {

    static final String SYSTEM_PROMPT = """
            You are the WhatsApp assistant for Durdans Laboratory, a medical laboratory in Colombo, Sri Lanka.

            Language: detect the patient's language and reply in it. Sinhala script gets Sinhala. \
            Sinhala written in Latin letters ("Singlish") gets Sinhala. English gets English. \
            Always give test names in both the local form and the English abbreviation, because \
            the requisition slip and the report are printed in English.

            You can help with: test prices, packages and their savings, fasting and preparation \
            instructions, turnaround times, and general guidance to contact the laboratory.

            Hard rules, no exceptions:
            - Prices, package contents, savings, preparation instructions and turnaround times MUST \
            come from the tools. Never invent, estimate, round or convert them. If a tool finds no \
            match, say so and suggest calling the laboratory.
            - NEVER provide test results, report values, reference ranges, diagnoses or medical \
            advice of any kind. If asked about a report or a result, say that report delivery over \
            WhatsApp is coming soon and reports are currently issued at the laboratory desk.
            - Keep replies short and WhatsApp-friendly: a few lines, no tables, no markdown \
            headings, at most one emoji.
            - Prices are Sri Lankan Rupees; write them like "Rs. 1,500".
            - For anything outside laboratory services, politely say you can only help with \
            laboratory matters.""";

    private static final int MAX_REPLY_CHARS = 3500;

    private final AgentProperties properties;
    private final GeminiClient gemini;
    private final CoreCatalogClient catalog;
    private final WaMessageRepository messageRepository;
    private final ObjectMapper mapper;

    /**
     * @return the agent's answer, or empty when the model produced nothing usable —
     * the caller decides what a patient hears in that case, not this class
     */
    public Optional<String> reply(UUID conversationId) {
        ArrayNode contents = historyAsContents(conversationId);
        if (contents.isEmpty()) {
            return Optional.empty();
        }

        for (int round = 0; round <= properties.maxToolRounds(); round++) {
            JsonNode content = gemini.generate(requestBody(contents));
            List<JsonNode> calls = functionCalls(content);
            if (calls.isEmpty()) {
                return textOf(content);
            }
            contents.add(content);
            contents.add(toolResponses(calls));
        }
        // The model kept asking for tools past the cap. Answering with a half-built
        // context risks an ungrounded number, so no answer is the safer answer.
        log.warn("Agent exceeded {} tool rounds on conversation {}", properties.maxToolRounds(), conversationId);
        return Optional.empty();
    }

    private ArrayNode historyAsContents(UUID conversationId) {
        List<WaMessageEntity> newestFirst = messageRepository
                .findByConversation_IdOrderByCreatedAtDesc(conversationId, PageRequest.of(0, properties.historyLimit()));
        List<WaMessageEntity> chronological = new ArrayList<>(newestFirst);
        java.util.Collections.reverse(chronological);

        ArrayNode contents = mapper.createArrayNode();
        for (WaMessageEntity message : chronological) {
            if (message.getBody() == null || message.getBody().isBlank()) {
                continue;
            }
            ObjectNode turn = contents.addObject();
            turn.put("role", message.getDirection() == MessageDirection.INBOUND ? "user" : "model");
            turn.putArray("parts").addObject().put("text", message.getBody());
        }
        return contents;
    }

    private ObjectNode requestBody(ArrayNode contents) {
        ObjectNode body = mapper.createObjectNode();
        body.putObject("systemInstruction").putArray("parts").addObject().put("text", SYSTEM_PROMPT);
        body.set("contents", contents);
        body.putArray("tools").addObject().set("functionDeclarations", toolDeclarations());
        ObjectNode config = body.putObject("generationConfig");
        config.put("temperature", 0.2);
        config.put("maxOutputTokens", 1024);
        return body;
    }

    private ArrayNode toolDeclarations() {
        ArrayNode declarations = mapper.createArrayNode();

        ObjectNode search = declarations.addObject();
        search.put("name", "searchTests");
        search.put("description", "Search the laboratory test catalogue. Matches test code (FBC, HBA1C), "
                + "English name, Sinhala/Tamil name and colloquial names. Returns prices in LKR, sample type, "
                + "turnaround hours, fasting and preparation requirements.");
        ObjectNode searchParams = search.putObject("parameters");
        searchParams.put("type", "object");
        ObjectNode searchProps = searchParams.putObject("properties");
        searchProps.putObject("query").put("type", "string")
                .put("description", "What the patient called the test, in any language");
        searchProps.putObject("locale").put("type", "string")
                .put("description", "Preferred reply language: si, ta or en");
        searchParams.putArray("required").add("query");

        ObjectNode list = declarations.addObject();
        list.put("name", "listPackages");
        list.put("description", "List the laboratory's active test packages with bundle price, "
                + "what the tests cost individually, and the saving.");
        ObjectNode listParams = list.putObject("parameters");
        listParams.put("type", "object");
        listParams.putObject("properties").putObject("locale").put("type", "string")
                .put("description", "Preferred reply language: si, ta or en");

        ObjectNode get = declarations.addObject();
        get.put("name", "getPackage");
        get.put("description", "Get one package by its code, including every test it contains.");
        ObjectNode getParams = get.putObject("parameters");
        getParams.put("type", "object");
        ObjectNode getProps = getParams.putObject("properties");
        getProps.putObject("packageCode").put("type", "string");
        getProps.putObject("locale").put("type", "string");
        getParams.putArray("required").add("packageCode");

        return declarations;
    }

    private static List<JsonNode> functionCalls(JsonNode content) {
        List<JsonNode> calls = new ArrayList<>();
        for (JsonNode part : content.path("parts")) {
            if (part.has("functionCall")) {
                calls.add(part.get("functionCall"));
            }
        }
        return calls;
    }

    private ObjectNode toolResponses(List<JsonNode> calls) {
        ObjectNode turn = mapper.createObjectNode();
        turn.put("role", "user");
        ArrayNode parts = turn.putArray("parts");
        for (JsonNode call : calls) {
            String name = call.path("name").asText();
            JsonNode args = call.path("args");
            String resultJson = dispatch(name, args);

            ObjectNode response = parts.addObject().putObject("functionResponse");
            response.put("name", name);
            ObjectNode wrapper = response.putObject("response");
            try {
                wrapper.set("content", mapper.readTree(resultJson));
            } catch (Exception e) {
                wrapper.put("content", resultJson);
            }
        }
        return turn;
    }

    private String dispatch(String name, JsonNode args) {
        return switch (name) {
            case "searchTests" -> catalog.searchTests(args.path("query").asText(null), localeOf(args));
            case "listPackages" -> catalog.listPackages(localeOf(args));
            case "getPackage" -> catalog.getPackage(args.path("packageCode").asText(""), localeOf(args));
            default -> "{\"error\":\"unknown tool\"}";
        };
    }

    private static String localeOf(JsonNode args) {
        String locale = args.path("locale").asText(null);
        return locale == null || locale.isBlank() ? null : locale;
    }

    private static Optional<String> textOf(JsonNode content) {
        StringBuilder text = new StringBuilder();
        for (JsonNode part : content.path("parts")) {
            String chunk = part.path("text").asText("");
            if (!chunk.isBlank()) {
                if (!text.isEmpty()) {
                    text.append('\n');
                }
                text.append(chunk.trim());
            }
        }
        if (text.isEmpty()) {
            return Optional.empty();
        }
        String answer = text.toString();
        return Optional.of(answer.length() > MAX_REPLY_CHARS ? answer.substring(0, MAX_REPLY_CHARS) : answer);
    }
}
