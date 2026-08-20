package com.uom.lims.whatsapp.outbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.uom.lims.whatsapp.config.MetaProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * The one place this service talks to the WhatsApp Cloud API. Kept deliberately thin:
 * no policy, no persistence — the 24-hour window and the message row are
 * {@link OutboundMessageService}'s problem. This class knows how to turn a body and a
 * recipient into a {@code wamid} or a {@link MetaSendException}, nothing else.
 */
@Slf4j
@Component
public class MetaSendClient {

    private final MetaProperties properties;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public MetaSendClient(MetaProperties properties, RestClient metaRestClient, ObjectMapper objectMapper) {
        this.properties = properties;
        this.restClient = metaRestClient;
        this.objectMapper = objectMapper;
    }

    /** One row of an interactive list. Meta caps title at 24 chars, description at 72. */
    public record MenuRow(String id, String title, String description) {
    }

    /**
     * Sends a free-form text message. Callers must have already decided the send is
     * allowed — this method enforces configuration, not policy.
     *
     * @return the {@code wamid} Meta assigned, which is what delivery statuses key on
     */
    public String sendText(String toWaId, String body) {
        return dispatch(new TextPayload("whatsapp", "individual", toWaId, "text",
                new TextPayload.Text(false, body)));
    }

    /**
     * Sends an interactive list message — a body line plus a tappable menu. Inside the
     * 24-hour window these are ordinary free-form messages needing no Meta approval;
     * the tap comes back on the webhook as a {@code list_reply} carrying the row title.
     */
    public String sendInteractiveList(String toWaId, String body, String buttonLabel, List<MenuRow> rows) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("messaging_product", "whatsapp");
        root.put("recipient_type", "individual");
        root.put("to", toWaId);
        root.put("type", "interactive");
        var interactive = root.putObject("interactive");
        interactive.put("type", "list");
        interactive.putObject("body").put("text", body);
        var action = interactive.putObject("action");
        action.put("button", buttonLabel);
        var rowsNode = action.putArray("sections").addObject().putArray("rows");
        for (MenuRow row : rows) {
            var rowNode = rowsNode.addObject();
            rowNode.put("id", row.id());
            rowNode.put("title", row.title());
            if (row.description() != null && !row.description().isBlank()) {
                rowNode.put("description", row.description());
            }
        }
        return dispatch(root);
    }

    private String dispatch(Object payload) {
        if (!properties.isSendConfigured()) {
            // Same posture as the signature verifier: a half-configured deployment
            // refuses locally instead of sending an unauthenticated call to Meta.
            throw new MetaSendException("Meta send credentials are not configured; refusing to send");
        }

        SendResponse response = restClient.post()
                .uri(properties.phoneNumberEndpoint() + "/messages")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.accessToken())
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (request, res) -> {
                    throw new MetaSendException("Graph API returned " + res.getStatusCode().value()
                            + ": " + safeErrorSnippet(res.getBody()));
                })
                .body(SendResponse.class);

        if (response == null || response.messages() == null || response.messages().isEmpty()
                || response.messages().get(0).id() == null) {
            throw new MetaSendException("Graph API accepted the send but returned no message id");
        }
        return response.messages().get(0).id();
    }

    /**
     * Graph error bodies carry the diagnosis that matters during rollout — "(#131030)
     * recipient not in allowed list" is the entire story when testing against a sandbox
     * number. But they can also echo the recipient's phone number, and this string ends
     * up in a log line. Long digit runs are masked; 6-digit error codes survive.
     */
    private static String safeErrorSnippet(InputStream errorBody) {
        try {
            String raw = new String(errorBody.readNBytes(1024), StandardCharsets.UTF_8);
            return raw.replaceAll("\\d{7,}", "***");
        } catch (IOException e) {
            return "(error body unreadable)";
        }
    }

    record TextPayload(
            @JsonProperty("messaging_product") String messagingProduct,
            @JsonProperty("recipient_type") String recipientType,
            String to,
            String type,
            Text text) {

        record Text(@JsonProperty("preview_url") boolean previewUrl, String body) {
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record SendResponse(List<SentMessage> messages) {

        @JsonIgnoreProperties(ignoreUnknown = true)
        record SentMessage(String id) {
        }
    }
}
