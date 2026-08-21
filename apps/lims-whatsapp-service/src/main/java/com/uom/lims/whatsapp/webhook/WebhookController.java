package com.uom.lims.whatsapp.webhook;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.whatsapp.config.MetaProperties;
import com.uom.lims.whatsapp.inbound.InboundWebhookService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * The single public entry point of this service.
 *
 * <p>Two operations, both defined by Meta:
 * <ul>
 *   <li>{@code GET} — the subscription handshake. Meta calls it once when the callback
 *       URL is registered and expects the challenge echoed back as plain text.</li>
 *   <li>{@code POST} — every inbound message and status update.</li>
 * </ul>
 *
 * <p>The POST body is taken as {@code byte[]} rather than a mapped object because the
 * signature is computed over the exact bytes Meta sent. Letting Spring deserialize first
 * and re-serializing to verify would change whitespace and key order and fail every time.
 */
@Slf4j
@RestController
@RequestMapping("/webhook/whatsapp")
@RequiredArgsConstructor
public class WebhookController {

    private final MetaProperties properties;
    private final MetaSignatureVerifier signatureVerifier;
    private final InboundWebhookService inboundService;
    private final ObjectMapper objectMapper;

    /**
     * Subscription handshake. Returns the challenge only when the token matches, so a
     * third party cannot register their own callback against our app.
     */
    @GetMapping(produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> verify(
            @RequestParam("hub.mode") String mode,
            @RequestParam("hub.verify_token") String token,
            @RequestParam("hub.challenge") String challenge) {

        if (!properties.isSubscriptionConfigured()) {
            log.error("Rejecting subscription handshake: META_VERIFY_TOKEN is not configured");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        // Constant-time: the verify token is a shared secret, and a timing oracle on it
        // is as good as leaking it.
        boolean tokenMatches = MessageDigest.isEqual(
                properties.verifyToken().getBytes(StandardCharsets.UTF_8),
                token == null ? new byte[0] : token.getBytes(StandardCharsets.UTF_8));

        if (!"subscribe".equals(mode) || !tokenMatches) {
            log.warn("Rejected webhook subscription handshake");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        log.info("Webhook subscription handshake accepted");
        return ResponseEntity.ok(challenge);
    }

    @PostMapping
    public ResponseEntity<Void> receive(
            @RequestBody(required = false) byte[] rawBody,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature) {

        if (!signatureVerifier.isValid(rawBody, signature)) {
            // 403, not 401: there is no credential to re-present. Deliberately says
            // nothing about which part failed.
            log.warn("Rejected webhook delivery with an invalid signature");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        String body = new String(rawBody, StandardCharsets.UTF_8);
        WebhookPayload payload;
        try {
            payload = objectMapper.readValue(rawBody, WebhookPayload.class);
        } catch (Exception e) {
            // A signed payload we cannot parse is our bug, not a transient failure.
            // Acknowledge it: Meta would otherwise redeliver the same unparseable body
            // until it disables the subscription, taking every other message with it.
            log.error("Discarding a signed webhook payload that could not be parsed", e);
            return ResponseEntity.ok().build();
        }

        // Deliberately NOT wrapped in a try/catch. If persistence fails, the 500 makes
        // Meta redeliver, which is exactly what we want — acknowledging a message we
        // failed to store is the one way to lose it permanently.
        int stored = inboundService.ingest(payload, body, signature);
        if (stored > 0) {
            log.debug("Webhook delivery stored {} new message(s)", stored);
        }
        return ResponseEntity.ok().build();
    }
}
