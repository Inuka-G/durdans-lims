package com.uom.lims.whatsapp.voice;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Turns catalogue and order JSON into sentences a voice can read out.
 *
 * <p>This is where "tools return pre-rendered spoken strings" becomes literal: on the
 * native-audio path there is no draft to inspect before it is heard, so every number a
 * caller hears is composed HERE, from the core's JSON, and the model is instructed to
 * relay it. No symbols, no markdown, no emoji — punctuation a voice can breathe on.
 * Digits stay digits: the TTS reads "1200" correctly in every language we serve, while
 * spelling numbers out would need per-language rules this class should not own.
 */
@Component
public class VoiceSpokenFormatter {

    String spokenTestEn(JsonNode test) {
        StringBuilder spoken = new StringBuilder();
        spoken.append(test.path("englishName").asText(test.path("testCode").asText()))
                .append(" costs ").append(rupees(test.path("price"))).append(". ");
        if (test.path("turnAroundTimeHours").isNumber()) {
            spoken.append("Results are ready in about ")
                    .append(test.path("turnAroundTimeHours").asInt()).append(" hours. ");
        }
        if (test.path("fastingRequired").asBoolean(false)) {
            spoken.append("You need to fast");
            if (test.path("fastingHours").isNumber()) {
                spoken.append(" for ").append(test.path("fastingHours").asInt()).append(" hours");
            }
            spoken.append(" before the test.");
        } else {
            spoken.append("No fasting is needed.");
        }
        return spoken.toString().trim();
    }

    String spokenTestSi(JsonNode test) {
        String name = test.path("testName").asText(test.path("englishName").asText());
        String english = test.path("englishName").asText("");
        StringBuilder spoken = new StringBuilder();
        spoken.append(name);
        if (!english.isBlank() && !english.equals(name)) {
            spoken.append(", එනම් ").append(english).append(",");
        }
        spoken.append(" මිල රුපියල් ").append(number(test.path("price"))).append("යි. ");
        if (test.path("turnAroundTimeHours").isNumber()) {
            spoken.append("ප්‍රතිඵල පැය ").append(test.path("turnAroundTimeHours").asInt())
                    .append("කින් පමණ ලැබෙනවා. ");
        }
        if (test.path("fastingRequired").asBoolean(false)) {
            if (test.path("fastingHours").isNumber()) {
                spoken.append("පරීක්ෂණයට කලින් පැය ").append(test.path("fastingHours").asInt())
                        .append("ක් නිරාහාරව සිටිය යුතුයි.");
            } else {
                spoken.append("පරීක්ෂණයට කලින් නිරාහාරව සිටිය යුතුයි.");
            }
        } else {
            spoken.append("නිරාහාරව සිටීම අවශ්‍ය නැහැ.");
        }
        return spoken.toString().trim();
    }

    String spokenPackageEn(JsonNode pack) {
        StringBuilder spoken = new StringBuilder();
        spoken.append(pack.path("englishName").asText(pack.path("packageName").asText()))
                .append(" costs ").append(rupees(pack.path("price")));
        if (pack.path("saving").isNumber() && pack.path("saving").asDouble() > 0) {
            spoken.append(" and saves you ").append(rupees(pack.path("saving")))
                    .append(" compared to booking the tests separately");
        }
        spoken.append(". It includes ").append(pack.path("items").size()).append(" tests.");
        return spoken.toString();
    }

    String spokenPackageSi(JsonNode pack) {
        String name = pack.path("packageName").asText(pack.path("englishName").asText());
        StringBuilder spoken = new StringBuilder();
        spoken.append(name).append(" මිල රුපියල් ").append(number(pack.path("price"))).append("යි");
        if (pack.path("saving").isNumber() && pack.path("saving").asDouble() > 0) {
            spoken.append(", වෙන වෙනම කරනවාට වඩා රුපියල් ")
                    .append(number(pack.path("saving"))).append("ක් ඉතිරියි");
        }
        spoken.append(". පරීක්ෂණ ").append(pack.path("items").size()).append("ක් ඇතුළත්.");
        return spoken.toString();
    }

    String spokenOrderEn(JsonNode status) {
        if (!status.path("found").asBoolean(false)) {
            return "I could not verify that order for the number you are calling from. "
                    + "Please check the order number, or visit the laboratory desk.";
        }
        int total = status.path("totalTests").asInt();
        int done = status.path("testsCompleted").asInt();
        if (status.path("reportReady").asBoolean(false)) {
            return "Good news — your report is ready. You can collect it at the laboratory desk.";
        }
        if ("CANCELLED".equals(status.path("stage").asText())) {
            return "That order has been cancelled. Please contact the laboratory desk for details.";
        }
        return "Your order is still in progress. " + done + " of " + total
                + " tests are complete. The report is not ready yet.";
    }

    String spokenOrderSi(JsonNode status) {
        if (!status.path("found").asBoolean(false)) {
            return "ඔබ අමතන අංකයට එම ඇණවුම තහවුරු කරගන්න බැරි වුණා. "
                    + "අංකය නැවත බලලා උත්සාහ කරන්න, නැත්නම් රසායනාගාරයට පැමිණෙන්න.";
        }
        int total = status.path("totalTests").asInt();
        int done = status.path("testsCompleted").asInt();
        if (status.path("reportReady").asBoolean(false)) {
            return "සුබ ආරංචියක් — ඔබේ වාර්තාව සූදානම්. රසායනාගාරයෙන් ලබාගන්න පුළුවන්.";
        }
        if ("CANCELLED".equals(status.path("stage").asText())) {
            return "එම ඇණවුම අවලංගු කර ඇත. විස්තර සඳහා රසායනාගාරය අමතන්න.";
        }
        return "ඔබේ ඇණවුම තවම ක්‍රියාත්මකයි. පරීක්ෂණ " + total + "න් " + done
                + "ක් අවසන්. වාර්තාව තවම සූදානම් නැහැ.";
    }

    private static String rupees(JsonNode price) {
        return price != null && price.isNumber() ? "rupees " + number(price) : "an amount I could not read";
    }

    private static String number(JsonNode value) {
        if (value == null || !value.isNumber()) {
            return "0";
        }
        // No thousands separators: "1,200" invites a TTS pause; "1200" reads cleanly.
        return String.format(Locale.US, "%.0f", value.asDouble());
    }
}
