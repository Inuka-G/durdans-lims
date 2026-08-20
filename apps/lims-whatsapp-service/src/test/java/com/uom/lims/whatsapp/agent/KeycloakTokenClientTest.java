package com.uom.lims.whatsapp.agent;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class KeycloakTokenClientTest {

    private static final String TOKEN_URL = "http://keycloak:8080/realms/lims-realm/protocol/openid-connect/token";

    @Test
    void fetchesOnceAndServesTheRestFromCache() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        KeycloakTokenClient client = new KeycloakTokenClient(AgentTestFixtures.configured(), builder.build());

        // Exactly one HTTP exchange no matter how many callers ask within the lifetime.
        server.expect(ExpectedCount.once(), requestTo(TOKEN_URL))
                .andExpect(method(POST))
                .andExpect(content().formData(formOf()))
                .andRespond(withSuccess(
                        "{\"access_token\":\"tok-1\",\"expires_in\":300}", MediaType.APPLICATION_JSON));

        assertThat(client.accessToken()).isEqualTo("tok-1");
        assertThat(client.accessToken()).isEqualTo("tok-1");
        assertThat(client.accessToken()).isEqualTo("tok-1");
        server.verify();
    }

    @Test
    void anEmptyTokenResponseIsAnErrorNotACachedNull() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        KeycloakTokenClient client = new KeycloakTokenClient(AgentTestFixtures.configured(), builder.build());

        server.expect(requestTo(TOKEN_URL))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        org.assertj.core.api.Assertions.assertThatThrownBy(client::accessToken)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("no access token");
        server.verify();
    }

    private static org.springframework.util.MultiValueMap<String, String> formOf() {
        var form = new org.springframework.util.LinkedMultiValueMap<String, String>();
        form.add("grant_type", "client_credentials");
        form.add("client_id", "lims-agent");
        form.add("client_secret", "test-client-secret");
        return form;
    }
}
