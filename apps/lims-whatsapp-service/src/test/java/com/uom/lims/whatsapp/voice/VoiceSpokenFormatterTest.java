package com.uom.lims.whatsapp.voice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VoiceSpokenFormatterTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final VoiceSpokenFormatter formatter = new VoiceSpokenFormatter();

    private JsonNode json(String content) throws Exception {
        return mapper.readTree(content);
    }

    @Test
    void spokenTestCarriesPriceTurnaroundAndFastingWithoutSymbols() throws Exception {
        JsonNode test = json("""
                {"testCode":"FBC","englishName":"Full Blood Count","testName":"සම්පූර්ණ රුධිර ගණනය",
                 "price":1200.00,"turnAroundTimeHours":24,"fastingRequired":true,"fastingHours":12}""");

        String en = formatter.spokenTestEn(test);
        assertThat(en)
                .contains("Full Blood Count")
                .contains("rupees 1200")
                .contains("24 hours")
                .contains("fast")
                .doesNotContain("Rs.")
                .doesNotContain(",");

        String si = formatter.spokenTestSi(test);
        assertThat(si).contains("සම්පූර්ණ රුධිර ගණනය").contains("රුපියල් 1200").contains("පැය 12");
    }

    @Test
    void noFastingReadsAsANegativeSentenceNotAnOmission() throws Exception {
        JsonNode test = json("""
                {"testCode":"GLU","englishName":"Blood Glucose","price":900,"fastingRequired":false}""");

        assertThat(formatter.spokenTestEn(test)).contains("No fasting is needed");
        assertThat(formatter.spokenTestSi(test)).contains("අවශ්‍ය නැහැ");
    }

    @Test
    void orderNotFoundNeverHintsWhichCheckFailed() throws Exception {
        JsonNode status = json("{\"found\":false}");

        assertThat(formatter.spokenOrderEn(status))
                .contains("could not verify")
                .doesNotContain("phone")
                .doesNotContain("exists");
        assertThat(formatter.spokenOrderSi(status)).contains("තහවුරු");
    }

    @Test
    void readyOrderInvitesCollection() throws Exception {
        JsonNode status = json("""
                {"found":true,"stage":"REPORT_READY","reportReady":true,"totalTests":2,"testsCompleted":2}""");

        assertThat(formatter.spokenOrderEn(status)).contains("report is ready");
        assertThat(formatter.spokenOrderSi(status)).contains("සූදානම්");
    }

    @Test
    void inProgressOrderStatesTheCounts() throws Exception {
        JsonNode status = json("""
                {"found":true,"stage":"PROCESSING","reportReady":false,"totalTests":3,"testsCompleted":1}""");

        assertThat(formatter.spokenOrderEn(status)).contains("1 of 3");
        assertThat(formatter.spokenOrderSi(status)).contains("3න් 1");
    }

    @Test
    void packageSpokenIncludesSavingWhenPresent() throws Exception {
        JsonNode pack = json("""
                {"packageCode":"FULL","packageName":"සම්පූර්ණ පරීක්ෂාව","englishName":"Full Body Checkup",
                 "price":9900,"saving":2500,"items":[{},{},{}]}""");

        assertThat(formatter.spokenPackageEn(pack)).contains("saves you rupees 2500").contains("3 tests");
        assertThat(formatter.spokenPackageSi(pack)).contains("2500").contains("පරීක්ෂණ 3ක්");
    }
}
