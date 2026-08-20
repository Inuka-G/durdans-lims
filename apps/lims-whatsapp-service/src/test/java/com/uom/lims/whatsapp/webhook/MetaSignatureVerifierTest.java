package com.uom.lims.whatsapp.webhook;

import com.uom.lims.whatsapp.config.MetaProperties;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The webhook has no other authentication, so these are the tests that decide whether
 * a stranger can inject messages into the agent.
 */
class MetaSignatureVerifierTest {

    // Deliberately low-entropy and self-describing. HMAC-SHA256 does not care what the
    // key looks like, and a realistic-looking hex string here is indistinguishable from a
    // committed credential to a secret scanner — which is a false alarm nobody thanks you
    // for at 2am.
    private static final String SECRET = "test-app-secret-not-a-real-credential";
    private static final byte[] BODY =
            "{\"object\":\"whatsapp_business_account\",\"entry\":[]}".getBytes(StandardCharsets.UTF_8);

    private static MetaSignatureVerifier verifierWithSecret(String secret) {
        return new MetaSignatureVerifier(new MetaProperties(
                "app-id", secret, "verify-token", "phone-id", "waba-id", "token", null, null));
    }

    private static String sign(byte[] body, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void acceptsASignatureMetaWouldHaveProduced() {
        assertThat(verifierWithSecret(SECRET).isValid(BODY, sign(BODY, SECRET))).isTrue();
    }

    @Test
    void rejectsABodyThatChangedAfterSigning() {
        String signature = sign(BODY, SECRET);
        byte[] tampered = "{\"object\":\"whatsapp_business_account\",\"entry\":[1]}"
                .getBytes(StandardCharsets.UTF_8);

        assertThat(verifierWithSecret(SECRET).isValid(tampered, signature)).isFalse();
    }

    @Test
    void rejectsASignatureMadeWithADifferentSecret() {
        assertThat(verifierWithSecret(SECRET).isValid(BODY, sign(BODY, "test-app-secret-a-different-one"))).isFalse();
    }

    /**
     * The whole point of failing closed: an operator who forgets META_APP_SECRET gets a
     * service that accepts nothing, not one that accepts everything.
     */
    @Test
    void rejectsEverythingWhenNoAppSecretIsConfigured() {
        MetaSignatureVerifier verifier = verifierWithSecret("");

        assertThat(verifier.isValid(BODY, sign(BODY, SECRET))).isFalse();
        assertThat(verifier.isValid(BODY, "sha256=" + "00".repeat(32))).isFalse();
    }

    @Test
    void rejectsMalformedHeaders() {
        MetaSignatureVerifier verifier = verifierWithSecret(SECRET);

        assertThat(verifier.isValid(BODY, null)).isFalse();
        assertThat(verifier.isValid(BODY, "")).isFalse();
        // Right digest, missing the algorithm prefix Meta always sends.
        assertThat(verifier.isValid(BODY, sign(BODY, SECRET).substring("sha256=".length()))).isFalse();
        assertThat(verifier.isValid(BODY, "sha256=not-hex-at-all")).isFalse();
        // Correct prefix, digest truncated to half length.
        assertThat(verifier.isValid(BODY, "sha256=" + "ab".repeat(16))).isFalse();
    }

    @Test
    void rejectsAnAbsentBody() {
        assertThat(verifierWithSecret(SECRET).isValid(null, sign(BODY, SECRET))).isFalse();
    }
}
