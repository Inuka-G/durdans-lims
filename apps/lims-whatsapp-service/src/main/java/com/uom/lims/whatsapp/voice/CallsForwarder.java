package com.uom.lims.whatsapp.voice;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Hands "calls" webhook deliveries to the voice gateway, which runs the SDP dance.
 *
 * <p>Timing shapes everything here: Meta gives the business roughly 30 seconds from
 * the connect event to accept the call, so this happens synchronously on the webhook
 * thread with a tight client timeout — but a forwarding failure never fails the ack.
 * There is no retry either: redelivering a connect event for a call whose window has
 * passed would only make the gateway answer a call that no longer exists.
 */
@Slf4j
@Component
public class CallsForwarder {

    private final VoiceProperties properties;
    private final RestClient restClient;

    public CallsForwarder(VoiceProperties properties,
                          @Qualifier("voiceRestClient") RestClient restClient) {
        this.properties = properties;
        this.restClient = restClient;
    }

    /**
     * @param signature Meta's {@code X-Hub-Signature-256} over the raw body, passed through
     *                  so the gateway's WhatsApp client can re-verify it against the app
     *                  secret — the ingress already checked it, but a second check on the
     *                  other side of the host boundary costs nothing and removes a class of
     *                  trust assumption from the forwarding hop.
     */
    public void forward(String rawBody, String signature) {
        if (!properties.isConfigured()) {
            log.debug("Voice gateway not configured; dropping call event");
            return;
        }
        try {
            restClient.post()
                    .uri(properties.gatewayUrl() + "/internal/calls/webhook")
                    .header("X-Internal-Token", properties.internalToken())
                    .headers(h -> { if (signature != null && !signature.isBlank()) h.set("X-Hub-Signature-256", signature); })
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(rawBody)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Forwarded call event to the voice gateway");
        } catch (Exception e) {
            log.error("Forwarding a call event to the voice gateway failed: {}", e.getMessage());
        }
    }
}
