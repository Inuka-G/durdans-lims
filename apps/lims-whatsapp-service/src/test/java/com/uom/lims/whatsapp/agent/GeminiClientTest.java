package com.uom.lims.whatsapp.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GeminiClientTest {

    private static final String URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    private final ObjectMapper mapper = new ObjectMapper();
    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final GeminiClient client =
            new GeminiClient(AgentTestFixtures.configured(), builder.build(), mapper);

    private ObjectNode anyBody() {
        ObjectNode body = mapper.createObjectNode();
        body.putArray("contents").addObject().put("role", "user");
        return body;
    }

    @Test
    void postsWithTheKeyInAHeaderAndReturnsTheFirstCandidatesContent() {
        server.expect(requestTo(URL))
                .andExpect(method(POST))
                .andExpect(header("x-goog-api-key", "test-gemini-key"))
                .andExpect(jsonPath("$.contents[0].role").value("user"))
                .andRespond(withSuccess("""
                        {"candidates":[{"content":{"role":"model","parts":[{"text":"hello"}]}}]}""",
                        MediaType.APPLICATION_JSON));

        JsonNode content = client.generate(anyBody());

        assertThat(content.path("parts").path(0).path("text").asText()).isEqualTo("hello");
        server.verify();
    }

    @Test
    void anEmptyCandidateListBecomesAnEmptyContentNotAnException() {
        // Safety stops and empty candidates are an expected runtime outcome; the
        // orchestrator turns "no content" into the fallback line, not a stack trace.
        server.expect(requestTo(URL))
                .andRespond(withSuccess("{\"candidates\":[]}", MediaType.APPLICATION_JSON));

        assertThat(client.generate(anyBody()).path("parts").isMissingNode()).isTrue();
        server.verify();
    }

    @Test
    void quotaAndAuthFailuresSurfaceTheStatusCode() {
        server.expect(requestTo(URL))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":{\"status\":\"RESOURCE_EXHAUSTED\"}}"));

        assertThatThrownBy(() -> client.generate(anyBody()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("429");
        server.verify();
    }
}
