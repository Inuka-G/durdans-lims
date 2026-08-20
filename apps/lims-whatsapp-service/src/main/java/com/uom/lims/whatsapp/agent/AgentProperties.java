package com.uom.lims.whatsapp.agent;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Everything the text agent needs to exist. All of it externalized, all of it optional:
 * with any piece missing the agent simply does not engage and the static greeting keeps
 * answering, which is the same fail-closed posture as the webhook and the send path.
 *
 * <p>Gemini is called over its REST surface directly rather than through Spring AI.
 * The design doc names Spring AI as the eventual client; the deviation is deliberate for
 * this slice — one fewer dependency tree to reconcile with the pinned framework
 * versions, and the tool layer below it is client-agnostic, so swapping later touches
 * one class.
 */
@ConfigurationProperties(prefix = "app.agent")
public record AgentProperties(
        boolean enabled,
        String geminiApiKey,
        String geminiModel,
        String geminiBaseUrl,
        String coreBaseUrl,
        String tokenUrl,
        String clientId,
        String clientSecret,
        int maxToolRounds,
        int historyLimit) {

    public AgentProperties {
        geminiModel = blank(geminiModel) ? "gemini-2.5-flash" : geminiModel.trim();
        geminiBaseUrl = blank(geminiBaseUrl) ? "https://generativelanguage.googleapis.com" : geminiBaseUrl.trim();
        coreBaseUrl = blank(coreBaseUrl) ? "http://app:11000" : coreBaseUrl.trim();
        tokenUrl = blank(tokenUrl)
                ? "http://keycloak:8080/realms/lims-realm/protocol/openid-connect/token" : tokenUrl.trim();
        clientId = blank(clientId) ? "lims-agent" : clientId.trim();
        maxToolRounds = maxToolRounds <= 0 ? 4 : maxToolRounds;
        historyLimit = historyLimit <= 0 ? 10 : historyLimit;
    }

    /** The agent engages only when every credential it depends on is present. */
    public boolean isConfigured() {
        return enabled && !blank(geminiApiKey) && !blank(clientSecret);
    }

    /**
     * Whether the catalogue can be reached at all. Deliberately independent of the
     * Gemini key: the deterministic menus only need the core, so a missing model key
     * degrades the bot to menus rather than to silence.
     */
    public boolean isCoreConfigured() {
        return enabled && !blank(clientSecret);
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
