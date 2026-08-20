package com.uom.lims.whatsapp.util;

/**
 * Masks identifiers before they reach a log line.
 *
 * <p>A WhatsApp id is a phone number, and on this service every log line is about a
 * patient contacting a hospital — which is itself health-adjacent information. Logs
 * are aggregated, shipped and retained far more loosely than the database is, so
 * nothing identifying goes into them in the clear.
 *
 * <p>Mirrors the core service's masker rather than sharing it: the two services do not
 * share a jar, and a copied twenty-line utility is cheaper than a shared module.
 */
public final class PiiMasker {

    private PiiMasker() {
    }

    /** {@code 94771234567} becomes {@code 947****4567}. */
    public static String maskWaId(String waId) {
        if (waId == null || waId.isBlank()) {
            return "(none)";
        }
        String trimmed = waId.trim();
        if (trimmed.length() <= 7) {
            return "*".repeat(trimmed.length());
        }
        return trimmed.substring(0, 3) + "****" + trimmed.substring(trimmed.length() - 4);
    }

    /**
     * Message bodies are never logged in full — a patient may have typed an NIC, an
     * address or a symptom. Only the length survives, which is enough to correlate a
     * log line with a stored message without reproducing its content.
     */
    public static String describeBody(String body) {
        return body == null ? "(empty)" : "(" + body.length() + " chars)";
    }
}
