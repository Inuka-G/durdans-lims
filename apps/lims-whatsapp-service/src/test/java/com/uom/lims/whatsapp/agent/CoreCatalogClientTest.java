package com.uom.lims.whatsapp.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@ExtendWith(MockitoExtension.class)
class CoreCatalogClientTest {

    @Mock
    private KeycloakTokenClient tokenClient;

    private CoreCatalogClient clientAgainst(MockRestServiceServer[] serverHolder) {
        RestClient.Builder builder = RestClient.builder();
        serverHolder[0] = MockRestServiceServer.bindTo(builder).build();
        lenient().when(tokenClient.accessToken()).thenReturn("agent-token");
        return new CoreCatalogClient(AgentTestFixtures.configured(), tokenClient,
                builder.build(), new ObjectMapper());
    }

    @Test
    void unwrapsTheDataNodeAndSendsTheBearerToken() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        CoreCatalogClient client = clientAgainst(server);

        server[0].expect(requestTo("http://app:11000/api/v1/agent/catalog/tests?q=cbc&locale=si"))
                .andExpect(header("Authorization", "Bearer agent-token"))
                .andRespond(withSuccess(
                        "{\"success\":true,\"data\":[{\"testCode\":\"FBC\",\"price\":1200}]}",
                        MediaType.APPLICATION_JSON));

        assertThat(client.searchTests("cbc", "si"))
                .isEqualTo("[{\"testCode\":\"FBC\",\"price\":1200}]");
        server[0].verify();
    }

    @Test
    void aFailedLookupBecomesAJsonErrorTheModelCanExplain() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        CoreCatalogClient client = clientAgainst(server);

        server[0].expect(requestTo("http://app:11000/api/v1/agent/catalog/packages"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertThat(client.listPackages(null)).contains("\"error\"");
        server[0].verify();
    }

    @Test
    void packageLookupExpandsThePathVariable() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        CoreCatalogClient client = clientAgainst(server);

        server[0].expect(requestTo("http://app:11000/api/v1/agent/catalog/packages/FULL-BODY?locale=en"))
                .andRespond(withSuccess(
                        "{\"data\":{\"packageCode\":\"FULL-BODY\"}}", MediaType.APPLICATION_JSON));

        assertThat(client.getPackage("FULL-BODY", "en")).contains("FULL-BODY");
        server[0].verify();
    }
}
