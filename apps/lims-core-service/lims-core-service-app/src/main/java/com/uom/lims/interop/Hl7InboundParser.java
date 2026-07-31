package com.uom.lims.interop;

import java.util.ArrayList;
import java.util.List;

/**
 * Minimal inbound HL7 v2 parser for the messages a hospital HIS sends the LIS:
 * ADT (patient demographics) and ORM (orders). Extracts MSH (message type), PID
 * (patient) and OBR (ordered service) fields. Enough to drive patient sync and
 * order intake; adopt a full HL7 engine for production-grade validation.
 */
public final class Hl7InboundParser {

    private Hl7InboundParser() {
    }

    public record InPatient(String id, String lastName, String firstName, String dob, String sex) {
    }

    public record InOrder(String placerOrderNumber, String serviceCode, String serviceName) {
    }

    public record InMessage(String messageType, InPatient patient, List<InOrder> orders) {
    }

    public static InMessage parse(String message) {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("Empty HL7 message");
        }
        String[] segments = message.split("[\r\n]+");
        String messageType = null;
        InPatient patient = null;
        List<InOrder> orders = new ArrayList<>();

        for (String segment : segments) {
            String[] f = segment.split("\\|", -1);
            if (f.length == 0) {
                continue;
            }
            switch (f[0]) {
                case "MSH" -> messageType = component(field(f, 8), 0); // MSH-9 e.g. ORM^O01 -> ORM
                case "PID" -> {
                    String[] name = field(f, 5).split("\\^", -1);
                    patient = new InPatient(
                            field(f, 3),
                            name.length > 0 ? name[0] : "",
                            name.length > 1 ? name[1] : "",
                            field(f, 7), field(f, 8));
                }
                case "OBR", "ORC" -> {
                    String service = field(f, 4); // OBR-4 universal service id: code^name^system
                    if (!service.isBlank()) {
                        String[] sc = service.split("\\^", -1);
                        orders.add(new InOrder(field(f, 2),
                                sc.length > 0 ? sc[0] : "",
                                sc.length > 1 ? sc[1] : ""));
                    }
                }
                default -> { /* ignore other segments */ }
            }
        }
        return new InMessage(messageType, patient, orders);
    }

    private static String field(String[] f, int i) {
        return i < f.length ? f[i] : "";
    }

    private static String component(String field, int i) {
        String[] parts = field.split("\\^", -1);
        return i < parts.length ? parts[i] : "";
    }
}
