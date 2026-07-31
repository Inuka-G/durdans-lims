package com.uom.lims.simulator.astm;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Builders and a light decoder for ASTM E1394 / LIS2-A2 high-level records.
 *
 * <p>Fields are pipe-delimited ({@code |}), components caret-delimited
 * ({@code ^}). Records used here:
 * <ul>
 *   <li>H — message header (declares the delimiters)</li>
 *   <li>P — patient</li>
 *   <li>O — test order</li>
 *   <li>R — result</li>
 *   <li>Q — query (host-query mode: "what orders for this sample?")</li>
 *   <li>C — comment</li>
 *   <li>L — terminator</li>
 * </ul>
 */
public final class Lis2Records {

    public static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private Lis2Records() {
    }

    /** H record. The literal {@code \^&} declares repeat/component/escape delimiters. */
    public static String header(String analyzerName, String analyzerVersion) {
        return String.join("|",
                "H", "\\^&", "", "",
                analyzerName + "^" + analyzerVersion,
                "", "", "", "", "", "", "P", "LIS2-A2",
                LocalDateTime.now().format(TS));
    }

    /** P record. */
    public static String patient(int seq, String patientId, String lastName, String firstName,
                                 String dobYyyyMmDd, String sex) {
        return String.join("|",
                "P", String.valueOf(seq), "", "", patientId, "",
                lastName + "^" + firstName, "", dobYyyyMmDd, sex);
    }

    /** O record (test order). priority: S=stat, R=routine. action F=final. */
    public static String order(int seq, String sampleId, String panelCode, String panelName,
                               String priority, String specimenType) {
        return String.join("|",
                "O", String.valueOf(seq), sampleId, "",
                "^^^" + panelCode + "^" + panelName,
                priority,
                LocalDateTime.now().format(TS),
                "", "", "", "", "", "", "", specimenType,
                "", "", "", "", "", "", "", "", "", "", "F");
    }

    /**
     * R record (one analyte result).
     *
     * @param flag abnormal flag: N normal, L low, H high, LL critical-low, HH critical-high
     */
    public static String result(int seq, String testCode, String testName, String value, String unit,
                                String refRange, String flag, String operator, String instrumentId) {
        return String.join("|",
                "R", String.valueOf(seq),
                "^^^" + testCode + "^" + testName,
                value, unit, refRange, flag,
                "", "F", "", operator,
                LocalDateTime.now().format(TS),
                instrumentId);
    }

    /** Q record (host-query): ask the host for orders on a sample id. */
    public static String query(int seq, String sampleId) {
        return String.join("|",
                "Q", String.valueOf(seq),
                "^" + sampleId + "^",
                "", "", "", "", "", "", "", "", "O");
    }

    public static String comment(int seq, String text) {
        return String.join("|", "C", String.valueOf(seq), "I", text, "G");
    }

    public static String terminator() {
        return "L|1|N";
    }

    /** Render a received record into a readable one-liner for the host console. */
    public static String describe(String record) {
        String[] f = record.split("\\|", -1);
        if (f.length == 0 || f[0].isEmpty()) {
            return record;
        }
        return switch (f[0].charAt(0)) {
            case 'H' -> "HEADER   analyzer=" + field(f, 4);
            case 'P' -> "PATIENT  id=" + field(f, 4) + " name=" + field(f, 6).replace('^', ' ')
                    + " dob=" + field(f, 8) + " sex=" + field(f, 9);
            case 'O' -> "ORDER    sample=" + field(f, 2) + " panel=" + lastComponent(field(f, 4))
                    + " priority=" + field(f, 5);
            case 'R' -> "RESULT   test=" + lastComponent(field(f, 2)) + " value=" + field(f, 3)
                    + " " + field(f, 4) + " ref=[" + field(f, 5) + "] flag=" + flagLabel(field(f, 6));
            case 'Q' -> "QUERY    sample=" + field(f, 2).replace("^", "");
            case 'C' -> "COMMENT  " + field(f, 3);
            case 'L' -> "TERMINATOR";
            default -> record;
        };
    }

    private static String field(String[] f, int i) {
        return i < f.length ? f[i] : "";
    }

    private static String lastComponent(String composite) {
        String[] parts = composite.split("\\^", -1);
        // testCode^testName lives at the end of the ^^^code^name construct
        for (int i = parts.length - 1; i >= 0; i--) {
            if (!parts[i].isEmpty()) {
                // return code^name pair if present
                if (i >= 1 && !parts[i - 1].isEmpty()) {
                    return parts[i - 1] + " " + parts[i];
                }
                return parts[i];
            }
        }
        return composite;
    }

    private static String flagLabel(String flag) {
        return switch (flag) {
            case "L" -> "LOW";
            case "H" -> "HIGH";
            case "LL", "<" -> "CRITICAL-LOW";
            case "HH", ">" -> "CRITICAL-HIGH";
            case "N", "" -> "normal";
            default -> flag;
        };
    }
}
