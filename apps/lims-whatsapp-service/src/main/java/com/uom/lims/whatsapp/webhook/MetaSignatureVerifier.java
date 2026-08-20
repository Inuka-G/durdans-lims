package com.uom.lims.whatsapp.webhook;

import com.uom.lims.whatsapp.config.MetaProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Verifies the {@code X-Hub-Signature-256} header Meta sends with every webhook.
 *
 * <p>This is the only thing authenticating the webhook endpoint: it is a public URL
 * that accepts POSTs from the internet. Anyone who can forge a request past this check
 * can inject arbitrary "patient messages" into the agent.
 *
 * <p>Three properties matter and each is asserted by a test:
 * <ul>
 *   <li>The HMAC is computed over the <em>raw</em> request bytes. Re-serializing parsed
 *       JSON changes whitespace and key order and produces a different digest, so the
 *       controller takes {@code byte[]} rather than a mapped object.</li>
 *   <li>The comparison is constant-time. A byte-by-byte early exit leaks the expected
 *       digest to a patient attacker over enough attempts.</li>
 *   <li>With no app secret configured, every request is rejected. An unconfigured
 *       deployment must refuse traffic, never accept it unverified.</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MetaSignatureVerifier {

    private static final String ALGORITHM = "HmacSHA256";
    private static final String PREFIX = "sha256=";

    private final MetaProperties properties;

    public boolean isValid(byte[] rawBody, String signatureHeader) {
        if (!properties.isSignatureVerificationConfigured()) {
            log.error("Rejecting webhook: META_APP_SECRET is not configured, so no request can be verified");
            return false;
        }
        if (rawBody == null || signatureHeader == null || !signatureHeader.startsWith(PREFIX)) {
            return false;
        }

        byte[] expected = hmacSha256(rawBody, properties.appSecret());
        byte[] presented = decodeHex(signatureHeader.substring(PREFIX.length()));
        if (presented == null) {
            return false;
        }

        // MessageDigest.isEqual is the constant-time comparison in the JDK. It also
        // handles the length mismatch without short-circuiting on the first byte.
        return MessageDigest.isEqual(expected, presented);
    }

    private static byte[] hmacSha256(byte[] payload, String secret) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), ALGORITHM));
            return mac.doFinal(payload);
        } catch (Exception e) {
            // A missing HMAC-SHA256 provider is a broken JVM, not a runtime condition.
            throw new IllegalStateException("HMAC-SHA256 is unavailable", e);
        }
    }

    private static byte[] decodeHex(String hex) {
        try {
            return HexFormat.of().parseHex(hex);
        } catch (IllegalArgumentException e) {
            // A malformed signature is an invalid request, not an error worth logging
            // at a level that an attacker could use to fill the log.
            return null;
        }
    }
}
