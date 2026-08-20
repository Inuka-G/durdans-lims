package com.uom.lims.whatsapp.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Thin wrapper over Gemini's {@code generateContent} REST call. Deliberately schema-free
 * on both sides — the orchestrator owns what goes into {@code contents} and what a
 * function call means; this class owns transport, authentication and the error surface.
 *
 * <p>The API key travels in the {@code x-goog-api-key} header, never in the URL: request
 * lines end up in proxy and access logs, headers here do not.
 */
@Slf4j
@Component
public class GeminiClient {

    private final AgentProperties properties;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public GeminiClient(AgentProperties properties,
                        @Qualifier("agentRestClient") RestClient restClient,
                        ObjectMapper objectMapper) {
        this.properties = properties;
        this.restClient = restClient;
        this.objectMapper = objectMapper;
    }

    /**
     * @param requestBody the full generateContent body (contents, tools, config)
     * @return the first candidate's {@code content} node — parts may hold text or
     * functionCall entries; an empty object when the model returned nothing usable
     * (safety stop, empty candidate), which callers treat as "no answer"
     */
    public JsonNode generate(ObjectNode requestBody) {
        String uri = properties.geminiBaseUrl() + "/v1beta/models/" + properties.geminiModel()
                + ":generateContent";

        String raw = restClient.post()
                .uri(uri)
                .header("x-goog-api-key", properties.geminiApiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody.toString())
                .retrieve()
                .onStatus(HttpStatusCode::isError, (request, response) -> {
                    throw new IllegalStateException("Gemini returned "
                            + response.getStatusCode().value() + ": " + snippet(response.getBody()));
                })
                .body(String.class);

        try {
            JsonNode root = objectMapper.readTree(raw == null ? "{}" : raw);
            JsonNode content = root.path("candidates").path(0).path("content");
            return content.isMissingNode() ? objectMapper.createObjectNode() : content;
        } catch (IOException e) {
            throw new IllegalStateException("Gemini response could not be parsed", e);
        }
    }

    /** Error bodies carry quota and safety diagnostics; they never carry patient text. */
    private static String snippet(InputStream body) {
        try {
            return new String(body.readNBytes(512), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "(error body unreadable)";
        }
    }
}
