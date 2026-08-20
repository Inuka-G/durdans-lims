package com.uom.lims.whatsapp.outbound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
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

    public MetaSendClient(MetaProperties properties, RestClient metaRestClient) {
        this.properties = properties;
        this.restClient = metaRestClient;
    }

    /**
     * Sends a free-form text message. Callers must have already decided the send is
     * allowed — this method enforces configuration, not policy.
     *
     * @return the {@code wamid} Meta assigned, which is what delivery statuses key on
     */
    public String sendText(String toWaId, String body) {
        if (!properties.isSendConfigured()) {
            // Same posture as the signature verifier: a half-configured deployment
            // refuses locally instead of sending an unauthenticated call to Meta.
            throw new MetaSendException("Meta send credentials are not configured; refusing to send");
        }

        SendResponse response = restClient.post()
                .uri(properties.phoneNumberEndpoint() + "/messages")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.accessToken())
                .contentType(MediaType.APPLICATION_JSON)
                .body(new TextPayload("whatsapp", "individual", toWaId, "text", new TextPayload.Text(false, body)))
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
