package com.uom.lims.dispatch;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Patient-facing "authorized lab report ready" SMS formatter.
 *
 * <p>Formats a clean, professional medical notification containing the patient name,
 * test panel, report reference, clinical authorization status, and a direct secure
 * download URL for the full PDF report.
 */
@Component
public class LabReportMessageFormatter {

    // Bounded to 3 concatenated GSM segments to prevent network truncation
    private static final int MAX_SMS_LENGTH = 459;

    @Value("${app.reports.portal-url:https://reports.durdans.com/r/}")
    private String portalBaseUrl = "https://reports.durdans.com/r/";

    public String formatSms(LabReportData report) {
        String reportRef = report.reportReference() != null ? report.reportReference() : "REF";
        String downloadUrl = portalBaseUrl.endsWith("/") ? portalBaseUrl + reportRef : portalBaseUrl + "/" + reportRef;

        StringBuilder message = new StringBuilder("Durdans Hospital Laboratory\n")
                .append("Authorized Lab Report Ready\n")
                .append("\n")
                .append("Patient: ").append(value(report.patientName())).append("\n")
                .append("Test: ").append(value(report.testPanel())).append("\n")
                .append("Report Ref: ").append(shortReference(report.reportReference())).append("\n")
                .append("Status: Clinically authorized\n")
                .append("\n")
                .append("View & download your full official lab report:\n")
                .append(downloadUrl).append("\n")
                .append("\n")
                .append("Please consult your doctor with this report.");

        return message.length() <= MAX_SMS_LENGTH
                ? message.toString()
                : message.substring(0, MAX_SMS_LENGTH - 3) + "...";
    }

    private static String shortReference(String reference) {
        if (reference == null || reference.isBlank()) return "Not available";
        return reference.length() <= 16 ? reference : reference.substring(0, 12).toUpperCase();
    }

    private static String value(String value) {
        return value == null || value.isBlank() ? "Not recorded" : value.trim();
    }
}
