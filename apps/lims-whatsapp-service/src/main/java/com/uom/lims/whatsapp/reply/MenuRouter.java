package com.uom.lims.whatsapp.reply;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.whatsapp.agent.AgentProperties;
import com.uom.lims.whatsapp.agent.CoreCatalogClient;
import com.uom.lims.whatsapp.outbound.MetaSendClient;
import com.uom.lims.whatsapp.outbound.OutboundMessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Deterministic handling for menu taps. A tap is a known intent with a machine id, so
 * it deserves a catalogue lookup and a formatted answer, not a model call: faster,
 * free, impossible to hallucinate — and after 1 October 2026, when in-window service
 * messages become billable, the cheap path is also the designed-for path.
 *
 * <p>Everything here returns {@code false} instead of failing: an unknown id, an empty
 * catalogue, a lookup error all fall through to the agent tier, which can at least say
 * something graceful. Static texts are bilingual so this tier needs no notion of the
 * patient's language.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MenuRouter {

    static final String REPORT_PROMPT = """
            රිපෝට් status එක බලන්න ඔබේ receipt එකේ තියෙන order අංකය එවන්න (උදා: ORD-20260820-000123).

            To check your report, send the order number printed on your receipt (e.g. ORD-20260820-000123).""";

    static final String PREP_PROMPT = """
            මොන පරීක්ෂණය ගැනද? නම type කරන්න (උදා: FBC, Lipid Profile).

            Which test? Type its name (e.g. FBC, Lipid Profile).""";

    static final String CONTACT_CARD = """
            📍 Durdans Laboratory, 3 Alfred Place, Colombo 03
            📞 0115 410 000
            🕖 හැමදාම 7.00am – 8.00pm / Open daily 7.00am – 8.00pm""";

    static final String TYPE_THE_NAME = """
            පරීක්ෂණයේ නම type කරන්න (උදා: FBC, HbA1c, Lipid Profile).

            Type the test name (e.g. FBC, HbA1c, Lipid Profile).""";

    private static final int MAX_ROWS = 10;

    private final AgentProperties agentProperties;
    private final CoreCatalogClient catalog;
    private final OutboundMessageService outbound;
    private final ObjectMapper mapper;

    /** @return true when the tap was fully answered here; false falls through to the agent */
    public boolean route(InboundMessageStoredEvent event) {
        String id = event.interactiveId();
        if (id == null || id.isBlank()) {
            return false;
        }
        if (needsCatalog(id) && !agentProperties.isCoreConfigured()) {
            return false;
        }
        try {
            if ("menu_prices".equals(id)) {
                return testsMenu(event);
            }
            if ("menu_packages".equals(id)) {
                return packagesMenu(event);
            }
            if ("menu_report".equals(id)) {
                return text(event, REPORT_PROMPT);
            }
            if ("menu_prep".equals(id)) {
                return text(event, PREP_PROMPT);
            }
            if ("menu_contact".equals(id)) {
                return text(event, CONTACT_CARD);
            }
            if ("menu_other".equals(id)) {
                return text(event, TYPE_THE_NAME);
            }
            if (id.startsWith("test_")) {
                return testAnswer(event, id.substring("test_".length()));
            }
            if (id.startsWith("package_")) {
                return packageAnswer(event, id.substring("package_".length()));
            }
            return false;
        } catch (Exception e) {
            log.error("Menu routing failed for id {}", id, e);
            return false;
        }
    }

    private static boolean needsCatalog(String id) {
        return "menu_prices".equals(id) || "menu_packages".equals(id)
                || id.startsWith("test_") || id.startsWith("package_");
    }

    private boolean text(InboundMessageStoredEvent event, String body) {
        outbound.sendFreeFormText(event.conversationId(), body);
        return true;
    }

    private boolean testsMenu(InboundMessageStoredEvent event) throws Exception {
        JsonNode tests = mapper.readTree(catalog.searchTests("", "si"));
        if (!tests.isArray() || tests.isEmpty()) {
            return false;
        }
        List<MetaSendClient.MenuRow> rows = new ArrayList<>();
        for (JsonNode test : tests) {
            if (rows.size() >= MAX_ROWS - 1) {
                break;
            }
            String code = test.path("testCode").asText("");
            if (code.isBlank()) {
                continue;
            }
            String english = test.path("englishName").asText(test.path("testName").asText(code));
            String local = test.path("testName").asText("");
            String desc = price(test.path("price")) + (local.isBlank() || local.equals(english) ? "" : " • " + local);
            rows.add(new MetaSendClient.MenuRow("test_" + code, clip(english, 24), clip(desc, 72)));
        }
        if (rows.isEmpty()) {
            return false;
        }
        rows.add(new MetaSendClient.MenuRow("menu_other", "Something else…", "වෙනත් පරීක්ෂණයක් — type the name"));
        outbound.sendMenu(event.conversationId(),
                "පරීක්ෂණයක් තෝරන්න — prices ලැබෙයි.\n\nPick a test to see its price.",
                "Tests", rows);
        return true;
    }

    private boolean packagesMenu(InboundMessageStoredEvent event) throws Exception {
        JsonNode packages = mapper.readTree(catalog.listPackages("si"));
        if (!packages.isArray() || packages.isEmpty()) {
            return text(event, """
                    දැනට active packages නැහැ. ලඟදීම — කරුණාකර පසුව බලන්න.

                    No active packages right now — please check back soon.""");
        }
        List<MetaSendClient.MenuRow> rows = new ArrayList<>();
        for (JsonNode pack : packages) {
            if (rows.size() >= MAX_ROWS) {
                break;
            }
            String code = pack.path("packageCode").asText("");
            if (code.isBlank()) {
                continue;
            }
            String name = pack.path("englishName").asText(pack.path("packageName").asText(code));
            String desc = price(pack.path("price"));
            JsonNode saving = pack.path("saving");
            if (saving.isNumber() && saving.asDouble() > 0) {
                desc += " • save " + price(saving);
            }
            rows.add(new MetaSendClient.MenuRow("package_" + code, clip(name, 24), clip(desc, 72)));
        }
        if (rows.isEmpty()) {
            return false;
        }
        outbound.sendMenu(event.conversationId(),
                "Package එකක් තෝරන්න — විස්තර ලැබෙයි.\n\nPick a package to see what it includes.",
                "Packages", rows);
        return true;
    }

    private boolean testAnswer(InboundMessageStoredEvent event, String code) throws Exception {
        JsonNode tests = mapper.readTree(catalog.searchTests(code, "si"));
        JsonNode match = null;
        for (JsonNode test : tests) {
            if (code.equalsIgnoreCase(test.path("testCode").asText())) {
                match = test;
                break;
            }
        }
        if (match == null) {
            return false;
        }

        StringBuilder answer = new StringBuilder();
        String english = match.path("englishName").asText(code);
        String local = match.path("testName").asText("");
        answer.append("🧪 ").append(match.path("testCode").asText(code)).append(" — ").append(english);
        if (!local.isBlank() && !local.equals(english)) {
            answer.append(" (").append(local).append(')');
        }
        answer.append("\nමිල / Price: ").append(price(match.path("price")));
        if (match.path("turnAroundTimeHours").isNumber()) {
            answer.append("\nකාලය / Turnaround: ").append(match.path("turnAroundTimeHours").asInt()).append("h");
        }
        if (match.path("fastingRequired").asBoolean(false)) {
            answer.append("\nනිරාහාරව / Fasting: ");
            if (match.path("fastingHours").isNumber()) {
                answer.append("පැය ").append(match.path("fastingHours").asInt())
                        .append(" / ").append(match.path("fastingHours").asInt()).append(" hours");
            } else {
                answer.append("අවශ්‍යයි / required");
            }
        } else {
            answer.append("\nනිරාහාරව / Fasting: අවශ්‍ය නැහැ / not required");
        }
        String prep = match.path("prepInstruction").asText("");
        if (match.path("specialPrepRequired").asBoolean(false) && !prep.isBlank()) {
            answer.append("\nℹ️ ").append(clip(prep, 300));
        }
        return text(event, answer.toString());
    }

    private boolean packageAnswer(InboundMessageStoredEvent event, String code) throws Exception {
        JsonNode pack = mapper.readTree(catalog.getPackage(code, "si"));
        if (!pack.isObject() || pack.path("packageCode").asText("").isBlank()) {
            return false;
        }

        StringBuilder answer = new StringBuilder();
        answer.append("📦 ").append(pack.path("englishName").asText(pack.path("packageName").asText(code)));
        answer.append("\nමිල / Price: ").append(price(pack.path("price")));
        JsonNode individual = pack.path("individualTotal");
        JsonNode saving = pack.path("saving");
        if (individual.isNumber() && saving.isNumber() && saving.asDouble() > 0) {
            answer.append("\nවෙන වෙනම / Individually: ").append(price(individual))
                    .append(" → ඉතිරිය / You save: ").append(price(saving));
        }
        JsonNode items = pack.path("items");
        if (items.isArray() && !items.isEmpty()) {
            answer.append("\nඇතුළත් / Includes (").append(items.size()).append("):");
            int shown = 0;
            for (JsonNode item : items) {
                if (shown++ >= 6) {
                    answer.append("\n  …");
                    break;
                }
                answer.append("\n  • ").append(item.path("englishName").asText(item.path("testCode").asText()));
            }
        }
        if (pack.path("fastingRequired").asBoolean(false) && pack.path("fastingHours").isNumber()) {
            answer.append("\nනිරාහාරව / Fasting: පැය ").append(pack.path("fastingHours").asInt())
                    .append(" / ").append(pack.path("fastingHours").asInt()).append(" hours");
        }
        return text(event, answer.toString());
    }

    /** {@code 1200.00} → {@code Rs. 1,200}. Missing prices render as a dash, never a guess. */
    private static String price(JsonNode price) {
        if (price == null || !price.isNumber()) {
            return "Rs. —";
        }
        return String.format(Locale.US, "Rs. %,.0f", price.asDouble());
    }

    private static String clip(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
