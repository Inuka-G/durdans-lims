package com.uom.lims.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Unit coverage for PII masking used before values reach the logs (G4). */
class PiiMaskerTest {

    @Test
    void masksPhoneKeepingLastFour() {
        assertThat(PiiMasker.maskPhone("+94770001234")).isEqualTo("****1234");
        assertThat(PiiMasker.maskPhone("123")).isEqualTo("****");
        assertThat(PiiMasker.maskPhone(null)).isEqualTo("****");
    }

    @Test
    void masksEmailKeepingFirstCharAndDomain() {
        assertThat(PiiMasker.maskEmail("john.doe@example.com")).isEqualTo("j***@example.com");
        assertThat(PiiMasker.maskEmail("notanemail")).isEqualTo("****");
        assertThat(PiiMasker.maskEmail(null)).isEqualTo("****");
    }

    @Test
    void masksNicAndCode() {
        assertThat(PiiMasker.maskNic("901234567V")).isEqualTo("****567V");
        assertThat(PiiMasker.maskCode("P-VER-001")).isEqualTo("P-V****");
        assertThat(PiiMasker.maskCode("ab")).isEqualTo("****");
    }
}
