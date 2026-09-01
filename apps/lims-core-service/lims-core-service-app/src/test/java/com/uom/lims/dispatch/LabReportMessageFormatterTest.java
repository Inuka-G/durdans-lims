package com.uom.lims.dispatch;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LabReportMessageFormatterTest {

    @Test
    void formatsPatientTestAndDownloadUrlForSms() {
        String message = new LabReportMessageFormatter().formatSms(LabReportPdfServiceTest.sampleReport());

        assertThat(message)
                .startsWith("Durdans Hospital Laboratory\nAuthorized Lab Report Ready\n\nPatient: Kalana Sandakelum")
                .contains("\nTest: Full Blood Count")
                .contains("\nReport Ref: D87A4B51-3230")
                .contains("\nStatus: Clinically authorized")
                .contains("\nView & download your full official lab report:\nhttps://reports.durdans.com/r/d87a4b51-3230-45a4-a0c9-0b9dcbbfa742")
                .contains("\nPlease consult your doctor with this report.");
        assertThat(message).doesNotContain("\r").hasSizeLessThanOrEqualTo(459);
    }

    @Test
    void separatesTheBlocksWithBlankLines() {
        String message = new LabReportMessageFormatter().formatSms(LabReportPdfServiceTest.sampleReport());

        assertThat(message)
                .contains("Authorized Lab Report Ready\n\nPatient:")
                .contains("\n\nView & download your full official lab report:\n")
                .contains("\n\nPlease consult your doctor with this report.");
    }
}
