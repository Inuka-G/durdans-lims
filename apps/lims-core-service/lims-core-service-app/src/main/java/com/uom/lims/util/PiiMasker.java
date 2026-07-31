package com.uom.lims.util;

/**
 * Masks PII before it reaches the logs (G4). Use at call sites that would otherwise log
 * a phone / email / NIC / patient code. Keeps just enough of the value to correlate
 * without exposing the identifier. The logback encoder applies a regex backstop, but
 * masking at the source is the real control.
 */
public final class PiiMasker {

    private PiiMasker() {
    }

    /** "****1234" — keeps the last 4 chars. */
    public static String maskTail(String value) {
        if (value == null || value.length() <= 4) {
            return "****";
        }
        return "****" + value.substring(value.length() - 4);
    }

    public static String maskPhone(String phone) {
        return maskTail(phone);
    }

    /** NIC / passport / license — keep the last 4. */
    public static String maskNic(String nic) {
        return maskTail(nic);
    }

    /** "j***@example.com" — keeps the first char of the local part and the domain. */
    public static String maskEmail(String email) {
        if (email == null || email.isBlank()) {
            return "****";
        }
        int at = email.indexOf('@');
        if (at <= 0) {
            return "****";
        }
        return email.charAt(0) + "***" + email.substring(at);
    }

    /** "P-1****" — keeps a short prefix of a patient/order code. */
    public static String maskCode(String code) {
        if (code == null || code.length() <= 3) {
            return "****";
        }
        return code.substring(0, 3) + "****";
    }
}
