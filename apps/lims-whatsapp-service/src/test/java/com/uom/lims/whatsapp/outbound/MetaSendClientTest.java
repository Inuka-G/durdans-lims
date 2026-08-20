package com.uom.lims.whatsapp.outbound;

import com.uom.lims.whatsapp.config.MetaProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.http.HttpMethod.POST;

class MetaSendClientTest {

    private static final MetaProperties CONFIGURED = new MetaProperties(
            "app-id", "app-secret", "verify-token", "12345", "waba-id",
            "test-access-token", null, null);

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final MetaSendClient client = new MetaSendClient(CONFIGURED, builder.build());

    @Test
    void sendsTextAndReturnsTheAssignedWamid() {
        server.expect(requestTo("https://graph.facebook.com/v26.0/12345/messages"))
                .andExpect(method(POST))
                .andExpect(header("Authorization", "Bearer test-access-token"))
                .andExpect(jsonPath("$.messaging_product").value("whatsapp"))
                .andExpect(jsonPath("$.to").value("94771234567"))
                .andExpect(jsonPath("$.type").value("text"))
                .andExpect(jsonPath("$.text.body").value("hello"))
                .andRespond(withSuccess(
                        "{\"messages\":[{\"id\":\"wamid.ABC123\"}]}", MediaType.APPLICATION_JSON));

        assertThat(client.sendText("94771234567", "hello")).isEqualTo("wamid.ABC123");
        server.verify();
    }

    @Test
    void graphErrorSurfacesTheCodeButNotThePhoneNumber() {
        // The shape Meta actually returns during sandbox testing: the error code is the
        // diagnosis, the echoed recipient number is PII that must not reach a log line.
        server.expect(requestTo("https://graph.facebook.com/v26.0/12345/messages"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":{\"message\":\"(#131030) Recipient 94771234567 not in allowed list\",\"code\":131030}}"));

        assertThatThrownBy(() -> client.sendText("94771234567", "hello"))
                .isInstanceOf(MetaSendException.class)
                .hasMessageContaining("400")
                .hasMessageContaining("131030")
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain("94771234567"));
        server.verify();
    }

    @Test
    void refusesLocallyWhenSendCredentialsAreMissing() {
        MetaProperties unconfigured = new MetaProperties(
                "app-id", "app-secret", "verify-token", "12345", "waba-id", "", null, null);
        MetaSendClient failClosed = new MetaSendClient(unconfigured, RestClient.create());

        assertThatThrownBy(() -> failClosed.sendText("94771234567", "hello"))
                .isInstanceOf(MetaSendException.class)
                .hasMessageContaining("not configured");
        // No expectations were registered: a configured mock server would have failed
        // the test if any HTTP call had been attempted.
        server.verify();
    }

    @Test
    void missingMessageIdInAnAcceptedResponseIsAnError() {
        server.expect(requestTo("https://graph.facebook.com/v26.0/12345/messages"))
                .andRespond(withSuccess("{\"messages\":[]}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.sendText("94771234567", "hello"))
                .isInstanceOf(MetaSendException.class)
                .hasMessageContaining("no message id");
        server.verify();
    }
}
