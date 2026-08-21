package com.uom.lims.notification;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GsmTextTest {

    @Test
    void replacesTypographyThatWouldCostTwoThirdsOfTheMessage() {
        // One character outside GSM-7 drops the segment budget from 160 to 70, so a
        // single pasted em dash is enough to truncate a report SMS.
        assertThat(GsmText.sanitize("CRITICAL — patient")).isEqualTo("CRITICAL - patient");
        assertThat(GsmText.sanitize("range 5–10")).isEqualTo("range 5-10");
        assertThat(GsmText.sanitize("the patient’s sample")).isEqualTo("the patient's sample");
        assertThat(GsmText.sanitize("said “ready”")).isEqualTo("said \"ready\"");
        assertThat(GsmText.sanitize("more…")).isEqualTo("more...");
        assertThat(GsmText.sanitize("• Haemoglobin")).isEqualTo("- Haemoglobin");
    }

    @Test
    void normalizesLineEndingsToASingleForm() {
        assertThat(GsmText.sanitize("a\r\nb\rc\nd")).isEqualTo("a\nb\nc\nd");
    }

    @Test
    void keepsTheLineBreaksThatMakeUpTheLayout() {
        String message = "Durdans LIMS\nOrder received\n\nOrder: ORD-1";

        assertThat(GsmText.sanitize(message)).isEqualTo(message);
    }

    @Test
    void leavesCharactersItHasNoStandInFor() {
        // This normalizes typography; it does not strip content. A name that genuinely
        // needs UCS-2 still goes out as itself rather than as mangled ASCII.
        assertThat(GsmText.sanitize("කලන")).isEqualTo("කලන");
        assertThat(GsmText.sanitize("café")).isEqualTo("café");
    }

    @Test
    void handlesNullAndEmpty() {
        assertThat(GsmText.sanitize(null)).isNull();
        assertThat(GsmText.sanitize("")).isEmpty();
    }
}
