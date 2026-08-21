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

            Language: detect the patient's language from what THEY TYPED and reply in it. Sinhala \
            script gets Sinhala. Sinhala written in Latin letters ("Singlish") gets Sinhala. \
            English gets English. Menu selections (Test prices, Health packages, Report status, \
            Test preparation, Contact us, Something else…) are button taps, NOT language signals — \
            ignore their language and use the patient's own typed messages; when there is no typed \
            message to go by, default to Sinhala. If the patient switches language mid-conversation, \
            switch with them. Always give test names in both the local form and the English \
            abbreviation, because the requisition slip and the report are printed in English.

            You can help with: test prices, packages and their savings, fasting and preparation \
            instructions, turnaround times, and general guidance to contact the laboratory.

            Hard rules, no exceptions:
            - Prices, package contents, savings, preparation instructions and turnaround times MUST \
            come from the tools. Never invent, estimate, round or convert them. If a search finds no \
            match, retry it once with the standard English name or common synonym (CBC -> Full Blood \
            Count) before saying you could not find it.
            - NEVER provide test results, report values, reference ranges, diagnoses or medical \
            advice of any kind. Whether a report is READY may be answered via getOrderStatus; the \
            content of a report may not. Report content is issued at the laboratory desk.
            - Keep replies short and WhatsApp-friendly: a few lines, no tables, no markdown \
            headings, at most one emoji.
            - Prices are Sri Lankan Rupees; write them like "Rs. 1,500".
            - For anything outside laboratory services, politely say you can only help with \
            laboratory matters.

            Report status flow: you need the laboratory order number, printed on the receipt and \
            the request form (format ORD-YYYYMMDD-000000). Ask for it if the patient has not given \
            it. Then call getOrderStatus with exactly that number. The system verifies ownership \
            automatically using the WhatsApp number this message came from — do not ask for an NIC \
            or phone number for this flow (the NIC is only for verifyPatient, below). If the tool returns found=false, say the order \
            could not be verified for this WhatsApp number and suggest calling the laboratory — do \
            not reveal whether the order number exists.

            Without an order number: if the patient asks about "my report", "my order" or "my \
            results" and has no order number, do the identity step-up instead. Address them by \
            their WhatsApp profile name if you know it and ask whether it is really them, then ask \
            for their full name and NIC number, then call verifyPatient with exactly what they \
            said — the phone is checked automatically. If verified, greet them by firstName and \
            describe the most recent order naturally: which branch (branchName), when (orderedOn), \
            how far along it is (stage, testsCompleted of totalTests) and whether the report is \
            ready; then offer the others if there are several. If not verified, say you could not \
            verify those details for this WhatsApp number and suggest the laboratory desk — never \
            say which part failed and never reveal any order detail.

            When found, present it nicely: one line of overall progress (testsCompleted of \
            totalTests ready), then each test from items on its own line with a status emoji and \
            its stage in the patient's language. Stage meanings: AWAITING_COLLECTION = sample not \
            yet taken; COLLECTED = sample taken; AT_LAB = received at the laboratory; TESTING = \
            being tested; VERIFYING = results being checked by senior staff; READY = finished; \
            DISPATCHED = report issued; RECOLLECTION_NEEDED = a fresh sample is required — tell \
            the patient to please visit the laboratory again for this test. If reportReady is \
            true, say the report can be collected at the laboratory desk. Never mention internal \
            details beyond these stages, and never any result value.

            Menu selections arrive as plain text. "Test prices" -> ask which test. "Health \
            packages" -> call listPackages. "Report status" -> ask for the order number. "Test \
            preparation" -> ask which test, then use searchTests and relay its preparation fields. \
            "Contact us" -> give the laboratory contact details.

            Laboratory contact: Durdans Laboratory, 3 Alfred Place, Colombo 03. Phone: 0115 410 000. \
            Open daily 7:00 am - 8:00 pm.""";

    private static final int MAX_REPLY_CHARS = 3500;

    private final AgentProperties properties;
    private final GeminiClient gemini;
    private final CoreCatalogClient catalog;
    private final WaMessageRepository messageRepository;
    private final ObjectMapper mapper;

    /**
     * @param requesterWaId the WhatsApp sender, threaded into the possession-checked
     * tools server-side; the model has no parameter through which to supply or spoof it
     * @return the agent's answer, or empty when the model produced nothing usable —
     * the caller decides what a patient hears in that case, not this class
     */
    public Optional<String> reply(UUID conversationId, String requesterWaId, String displayName) {
        ArrayNode contents = historyAsContents(conversationId);
        if (contents.isEmpty()) {
            return Optional.empty();
        }

        for (int round = 0; round <= properties.maxToolRounds(); round++) {
            JsonNode content = gemini.generate(requestBody(contents, displayName));
            List<JsonNode> calls = functionCalls(content);
            if (calls.isEmpty()) {
                return textOf(content);
            }
            contents.add(content);
            contents.add(toolResponses(calls, requesterWaId));
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

    /**
     * The WhatsApp profile name rides in the system prompt rather than the history: it is
     * context about the person, not something they said — and it is a display name they
     * chose, so the prompt says exactly that.
     */
    private static String systemPrompt(String displayName) {
        if (displayName == null || displayName.isBlank()) {
            return SYSTEM_PROMPT;
        }
        return SYSTEM_PROMPT + "\n\nThe patient's WhatsApp profile name is \"" + displayName.trim()
                + "\". Use it to address them and to ask \"is that you?\" before the identity step-up; "
                + "it is a display name they chose, not a verified identity.";
    }

    private ObjectNode requestBody(ArrayNode contents, String displayName) {
        ObjectNode body = mapper.createObjectNode();
        body.putObject("systemInstruction").putArray("parts").addObject().put("text", systemPrompt(displayName));
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

        // Deliberately no phone/identity parameter: ownership is checked against the
        // WhatsApp sender, which the orchestrator injects and the model cannot reach.
        ObjectNode status = declarations.addObject();
        status.put("name", "getOrderStatus");
        status.put("description", "Progress of one laboratory order: stage (RECEIVED, PROCESSING, "
                + "REPORT_READY, CANCELLED), how many tests are completed, and whether the report is "
                + "ready. Returns found=false when the order cannot be verified for this patient.");
        ObjectNode statusParams = status.putObject("parameters");
        statusParams.put("type", "object");
        statusParams.putObject("properties").putObject("orderNo").put("type", "string")
                .put("description", "The order number from the receipt, e.g. ORD-20260820-000123");
        statusParams.putArray("required").add("orderNo");

        // Identity step-up for "my report / my order" without an order number. Possession
        // (the WhatsApp number) is injected server-side; the model supplies only what the
        // patient told it, and gets nothing back unless both agree with one record.
        ObjectNode verify = declarations.addObject();
        verify.put("name", "verifyPatient");
        verify.put("description", "Verify the patient by the full name and national identity number (NIC) "
                + "they state, against the patient record on this WhatsApp number. When verified, returns "
                + "firstName and recentOrders (each with orderNo, branchName, orderedOn, stage, reportReady, "
                + "testsCompleted, totalTests, items). Returns verified=false otherwise.");
        ObjectNode verifyParams = verify.putObject("parameters");
        verifyParams.put("type", "object");
        ObjectNode verifyProps = verifyParams.putObject("properties");
        verifyProps.putObject("identityNumber").put("type", "string")
                .put("description", "The NIC exactly as the patient stated it");
        verifyProps.putObject("fullName").put("type", "string")
                .put("description", "The full name exactly as the patient stated it");
        verifyParams.putArray("required").add("identityNumber").add("fullName");

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

    private ObjectNode toolResponses(List<JsonNode> calls, String requesterWaId) {
        ObjectNode turn = mapper.createObjectNode();
        turn.put("role", "user");
        ArrayNode parts = turn.putArray("parts");
        for (JsonNode call : calls) {
            String name = call.path("name").asText();
            JsonNode args = call.path("args");
            String resultJson = dispatch(name, args, requesterWaId);

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

    private String dispatch(String name, JsonNode args, String requesterWaId) {
        return switch (name) {
            case "searchTests" -> catalog.searchTests(args.path("query").asText(null), localeOf(args));
            case "listPackages" -> catalog.listPackages(localeOf(args));
            case "getPackage" -> catalog.getPackage(args.path("packageCode").asText(""), localeOf(args));
            case "getOrderStatus" -> catalog.getOrderStatus(args.path("orderNo").asText(""), requesterWaId);
            case "verifyPatient" -> catalog.verifyPatient(args.path("identityNumber").asText(""),
                    args.path("fullName").asText(""), requesterWaId);
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
