package com.uom.lims.dispatch;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LabReportMessageFormatterTest {

    @Test
    void formatsPatientTestAndResultDataForSms() {
        String message = new LabReportMessageFormatter().formatSms(LabReportPdfServiceTest.sampleReport());

        assertThat(message)
                .startsWith("Durdans LIMS\nAuthorized Lab Report\n\nPatient: Kalana Sandakelum")
                .contains("\nTest: Full Blood Count")
                .contains("\nResults:\n- White Blood Cell Count 12.8 10^9/L [HIGH]")
                .contains("\n- Haemoglobin 14.6 g/dL")
                .contains("\nReport: D87A4B51")
                .contains("\nStatus: Clinically authorized")
                .contains("\nPlease consult your doctor.");
        assertThat(message).doesNotContain("\r").hasSizeLessThanOrEqualTo(459);
    }

    @Test
    void separatesTheBlocksWithBlankLines() {
        // The layout is the feature: heading, then who and what, then the results, then
        // the reference and the advice. Collapse the blank lines and this is a wall of
        // text on a phone, which is where an abnormal flag gets missed.
        String message = new LabReportMessageFormatter().formatSms(LabReportPdfServiceTest.sampleReport());

        assertThat(message)
                .contains("Authorized Lab Report\n\nPatient:")
                .contains("\n\nResults:")
                .contains("\n\nReport: ")
                .contains("\n\nPlease consult your doctor.");
    }
}
