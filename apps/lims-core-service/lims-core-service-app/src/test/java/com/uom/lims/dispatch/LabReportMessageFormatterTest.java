package com.uom.lims.dispatch;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LabReportMessageFormatterTest {

    @Test
    void formatsPatientTestAndResultDataForSms() {
        String message = new LabReportMessageFormatter().formatSms(LabReportPdfServiceTest.sampleReport());

        assertThat(message)
                .startsWith("Durdans LIMS - Authorized Lab Report\nPatient: Kalana Sandakelum")
                .contains("\nTest: Full Blood Count")
                .contains("\nResults:\n- White Blood Cell Count 12.8 10^9/L [HIGH]")
                .contains("\n- Haemoglobin 14.6 g/dL")
                .contains("\nReport: D87A4B51")
                .contains("\nStatus: Clinically authorized")
                .contains("\nPlease consult your doctor.");
        assertThat(message).doesNotContain("\r").hasSizeLessThanOrEqualTo(459);
    }
}
