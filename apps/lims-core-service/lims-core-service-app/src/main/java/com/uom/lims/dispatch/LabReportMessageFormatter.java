package com.uom.lims.dispatch;

import org.springframework.stereotype.Component;

@Component
public class LabReportMessageFormatter {

    // Three concatenated GSM segments. Keeping this bounded avoids gateways or
    // handsets silently dropping the tail of an oversized message.
    private static final int MAX_SMS_LENGTH = 459;

    public String formatSms(LabReportData report) {
        StringBuilder message = new StringBuilder("Durdans LIMS - Authorized Lab Report\n")
                .append("Patient: ")
                .append(value(report.patientName()))
                .append("\nTest: ").append(value(report.testPanel()))
                .append("\nResults:");

        String footer = "\nReport: " + shortReference(report.reportReference())
                + "\nStatus: Clinically authorized"
                + "\nPlease consult your doctor.";

        if (report.results().isEmpty()) {
            message.append("\nPlease contact the laboratory for result details.");
        } else {
            for (LabReportData.ResultRow row : report.results()) {
                StringBuilder result = new StringBuilder("\n- ")
                        .append(value(row.parameter()))
                        .append(' ').append(value(row.value()));
                if (row.unit() != null && !row.unit().isBlank()) result.append(' ').append(row.unit().trim());
                if (row.flag() != null && !row.flag().isBlank() && !"NORMAL".equalsIgnoreCase(row.flag())) {
                    result.append(" [").append(row.flag().replace('_', ' ')).append(']');
                }
                if (message.length() + result.length() + footer.length() > MAX_SMS_LENGTH) {
                    message.append("\n- More results in emailed PDF");
                    break;
                }
                message.append(result);
            }
        }
        message.append(footer);
        return message.length() <= MAX_SMS_LENGTH
                ? message.toString()
                : message.substring(0, MAX_SMS_LENGTH - 3) + "...";
    }

    private static String shortReference(String reference) {
        if (reference == null || reference.isBlank()) return "Not available";
        return reference.length() <= 12 ? reference : reference.substring(0, 8).toUpperCase();
    }

    private static String value(String value) {
        return value == null || value.isBlank() ? "Not recorded" : value.trim();
    }
}
