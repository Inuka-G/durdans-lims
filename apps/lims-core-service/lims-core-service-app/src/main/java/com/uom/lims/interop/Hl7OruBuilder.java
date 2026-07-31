package com.uom.lims.interop;

import java.util.List;

/**
 * Builds an HL7 v2.5.1 ORU^R01 (unsolicited observation result) message in ER7
 * (pipe-delimited) encoding for transmission to the hospital HIS/EHR. Segments:
 * MSH (header), PID (patient), OBR (the ordered panel), one OBX per result.
 *
 * <p>Results carry their LOINC code (Phase 2), units, reference range and HL7
 * abnormal flag so the receiving system can interpret them unambiguously. This
 * is the outbound half of HL7 interoperability; an inbound ORM/ADT listener is
 * the complementary piece.
 */
public final class Hl7OruBuilder {

    private static final char FIELD = '|';
    private static final String ENCODING_CHARS = "^~\\&";

    private Hl7OruBuilder() {
    }

    public record Patient(String id, String lastName, String firstName, String dob, String sex) {
    }

    public record Observation(String loinc, String name, String value, String unit,
                              String refLow, String refHigh, String flag, boolean numeric) {
    }

    /**
     * @param messageControlId unique id for this message
     * @param timestamp        HL7 timestamp (yyyyMMddHHmmss) — passed in to keep this pure
     */
    public static String build(String messageControlId, String timestamp, Patient patient,
                               String accession, String panelLoinc, String panelName,
                               List<Observation> observations) {
        StringBuilder msg = new StringBuilder();

        msg.append("MSH").append(FIELD).append(ENCODING_CHARS).append(FIELD)
                .append("LIMS").append(FIELD).append("DURDANS").append(FIELD)
                .append("HIS").append(FIELD).append("DURDANS").append(FIELD)
                .append(timestamp).append(FIELD).append(FIELD)
                .append("ORU^R01").append(FIELD).append(messageControlId).append(FIELD)
                .append("P").append(FIELD).append("2.5.1").append('\r');

        msg.append("PID").append(FIELD).append("1").append(FIELD).append(FIELD)
                .append(nz(patient.id())).append(FIELD).append(FIELD)
                .append(nz(patient.lastName())).append('^').append(nz(patient.firstName())).append(FIELD)
                .append(FIELD).append(nz(patient.dob())).append(FIELD).append(nz(patient.sex())).append('\r');

        msg.append("OBR").append(FIELD).append("1").append(FIELD).append(FIELD)
                .append(nz(accession)).append(FIELD)
                .append(nz(panelLoinc)).append('^').append(nz(panelName)).append("^LN").append('\r');

        int seq = 1;
        for (Observation o : observations) {
            String range = (isBlank(o.refLow()) && isBlank(o.refHigh()))
                    ? "" : (nz(o.refLow()) + "-" + nz(o.refHigh()));
            msg.append("OBX").append(FIELD).append(seq++).append(FIELD)
                    .append(o.numeric() ? "NM" : "ST").append(FIELD)
                    .append(nz(o.loinc())).append('^').append(nz(o.name())).append("^LN").append(FIELD)
                    .append(FIELD)
                    .append(nz(o.value())).append(FIELD)
                    .append(nz(o.unit())).append(FIELD)
                    .append(range).append(FIELD)
                    .append(nz(o.flag())).append(FIELD)
                    .append(FIELD).append(FIELD)
                    .append("F").append('\r'); // result status: Final
        }

        return msg.toString();
    }

    /** Map the LIMS ResultFlag name to an HL7 v2 abnormal-flag code. */
    public static String hl7Flag(String resultFlag) {
        if (resultFlag == null) {
            return "";
        }
        return switch (resultFlag) {
            case "LOW" -> "L";
            case "HIGH" -> "H";
            case "CRITICAL_LOW" -> "LL";
            case "CRITICAL_HIGH" -> "HH";
            case "NORMAL" -> "N";
            default -> "";
        };
    }

    /**
     * Null-safe + HL7 escaping. A delimiter ({@code | ^ ~ & \}) inside a data
     * value (e.g. a name like {@code O'Brien^Jr}) would otherwise inject spurious
     * fields/components and corrupt the message; escape them per HL7 v2.
     */
    private static String nz(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("\\", "\\E\\")  // escape the escape char first
                .replace("|", "\\F\\")
                .replace("^", "\\S\\")
                .replace("&", "\\T\\")
                .replace("~", "\\R\\");
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
