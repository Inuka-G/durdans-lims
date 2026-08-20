package com.uom.lims.whatsapp.agent;

final class AgentTestFixtures {

    private AgentTestFixtures() {
    }

    static AgentProperties configured() {
        return new AgentProperties(true, "test-gemini-key", null, null, null, null, null,
                "test-client-secret", 0, 0);
    }

    static AgentProperties configured(String geminiBaseUrl, String coreBaseUrl, String tokenUrl) {
        return new AgentProperties(true, "test-gemini-key", null, geminiBaseUrl, coreBaseUrl, tokenUrl,
                null, "test-client-secret", 0, 0);
    }

    static AgentProperties unconfigured() {
        return new AgentProperties(true, "", null, null, null, null, null, "", 0, 0);
    }
}
