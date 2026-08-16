package com.uom.lims.notification;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OzoneDeskSmsServiceTest {

    private OzoneDeskSmsService service;
    private MockRestServiceServer server;

    @BeforeEach
    void setUp() {
        SmsProperties properties = new SmsProperties();
        properties.setEndpoint("http://sms.example.test/api/v1/send.php");
        properties.setUserId("105794");
        properties.setApiKey("test-secret");
        properties.setSenderId("DURDANS");

        RestTemplate restTemplate = new RestTemplate();
        server = MockRestServiceServer.bindTo(restTemplate).build();
        service = new OzoneDeskSmsService(properties, restTemplate);
        service.validateConfiguration();
    }

    @Test
    void sendsEncodedSmsWithConfiguredGatewayParameters() {
        server.expect(once(), method(HttpMethod.GET))
                .andExpect(queryParam("user_id", "105794"))
                .andExpect(queryParam("api_key", "test-secret"))
                .andExpect(queryParam("sender_id", "DURDANS"))
                .andExpect(queryParam("to", "94702011540"))
                .andExpect(queryParam("message", "Report%20R-42%20is%20ready%20%26%20verified"))
                .andRespond(withSuccess("SMS sent successfully", MediaType.TEXT_PLAIN));

        service.sendSms("+94 70 201 1540", "Report R-42 is ready & verified");

        server.verify();
    }

    @Test
    void convertsLocalSriLankanMobileNumberToGatewayFormat() {
        assertThat(OzoneDeskSmsService.normalizeSriLankanPhone("0702011540"))
                .isEqualTo("94702011540");
    }

    @Test
    void rejectsInvalidPhoneWithoutCallingGateway() {
        assertThatThrownBy(() -> service.sendSms("0112345678", "OTP 123456"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Sri Lankan mobile");
    }

    @Test
    void treatsExplicitProviderFailureAsDeliveryFailure() {
        server.expect(once(), method(HttpMethod.GET))
                .andRespond(withSuccess("Invalid API key", MediaType.TEXT_PLAIN));

        assertThatThrownBy(() -> service.sendSms("94702011540", "OTP 123456"))
                .isInstanceOf(OzoneDeskSmsService.SmsDeliveryException.class)
                .hasMessage("SMS gateway rejected the request");
        server.verify();
    }
}
