package com.uom.lims.notification;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
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
    void postsGatewayParametersAsAFormBody() {
        server.expect(once(), requestTo("http://sms.example.test/api/v1/send.php"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
                .andExpect(content().formData(formOf(
                        "user_id", "105794",
                        "api_key", "test-secret",
                        "sender_id", "DURDANS",
                        "to", "94702011540",
                        "message", "Report R-42 is ready & verified")))
                .andRespond(withSuccess("SMS sent successfully", MediaType.TEXT_PLAIN));

        service.sendSms("+94 70 201 1540", "Report R-42 is ready & verified");

        server.verify();
    }

    @Test
    void keepsTheApiKeyOutOfTheRequestUrl() {
        server.expect(once(), requestTo("http://sms.example.test/api/v1/send.php"))
                .andRespond(withSuccess("ok", MediaType.TEXT_PLAIN));

        // requestTo() above is an exact match, so a query string carrying the key
        // would fail this outright. Stated as its own test because that is the point.
        service.sendSms("0702011540", "hello");

        server.verify();
    }

    @Test
    void flattensLineBreaksTheGatewayWouldTruncateAt() {
        // OzoneDesk delivers only the first line of a multi-line message, even when it
        // arrives %0A-encoded in a form body — a dispatched report SMS reached the
        // patient as "Durdans Hospital Laboratory" alone. Every break becomes a " | "
        // separator so the whole message survives the gateway.
        String multiLine = "Durdans LIMS\nAuthorized Lab Report\n\nPatient: A B\n- Hb 9.1 g/dL [LOW]";

        server.expect(once(), method(HttpMethod.POST))
                .andExpect(content().formData(formOf(
                        "user_id", "105794",
                        "api_key", "test-secret",
                        "sender_id", "DURDANS",
                        "to", "94702011540",
                        "message", "Durdans LIMS | Authorized Lab Report | Patient: A B | - Hb 9.1 g/dL [LOW]")))
                .andRespond(withSuccess("SMS sent successfully", MediaType.TEXT_PLAIN));

        service.sendSms("0702011540", multiLine);

        server.verify();
    }

    @Test
    void normalizesTypographyThatWouldForceUcs2() {
        server.expect(once(), method(HttpMethod.POST))
                .andExpect(content().formData(formOf(
                        "user_id", "105794",
                        "api_key", "test-secret",
                        "sender_id", "DURDANS",
                        "to", "94702011540",
                        "message", "CRITICAL - Patient 'A' said \"go\"...")))
                .andRespond(withSuccess("ok", MediaType.TEXT_PLAIN));

        service.sendSms("0702011540", "CRITICAL — Patient ‘A’ said “go”…");

        server.verify();
    }

    // ------------------------------------------------------------------
    // Phone normalization. Every shape below is one a front desk actually types;
    // all of them used to throw, and because the OTP dispatcher swallows the
    // exception, the patient simply never got a code.
    // ------------------------------------------------------------------

    @ParameterizedTest
    @CsvSource({
            "0702011540,      94702011540",
            "0771234567,      94771234567",
            "+94702011540,    94702011540",
            "94702011540,     94702011540",
            "0094702011540,   94702011540",
            "+94 070 201 1540,94702011540",
            "940702011540,    94702011540",
            "702011540,       94702011540",
            "+94-77-123-4567, 94771234567",
            "  0702011540  ,  94702011540",
    })
    void normalizesEveryShapeAFrontDeskTypes(String entered, String expected) {
        assertThat(OzoneDeskSmsService.normalizeSriLankanPhone(entered.trim())).isEqualTo(expected);
    }

    @Test
    void acceptsMobilePrefixesOutsideTheOldHardcodedList() {
        // 073/079 are not allocated today, but the old whitelist would also have
        // rejected any prefix allocated tomorrow, silently, per patient.
        assertThat(OzoneDeskSmsService.normalizeSriLankanPhone("0731234567")).isEqualTo("94731234567");
        assertThat(OzoneDeskSmsService.normalizeSriLankanPhone("0791234567")).isEqualTo("94791234567");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "0112345678",   // Colombo landline
            "0812345678",   // Kandy landline
            "12345",        // too short
            "0702011540123" // too long
    })
    void rejectsWhatIsNotASriLankanMobile(String entered) {
        assertThatThrownBy(() -> service.sendSms(entered, "OTP 123456"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Sri Lankan mobile");
        server.verify(); // nothing was sent
    }

    // ------------------------------------------------------------------
    // Gateway responses
    // ------------------------------------------------------------------

    @Test
    void treatsExplicitProviderFailureAsDeliveryFailure() {
        server.expect(once(), method(HttpMethod.POST))
                .andRespond(withSuccess("Invalid API key", MediaType.TEXT_PLAIN));

        assertThatThrownBy(() -> service.sendSms("94702011540", "OTP 123456"))
                .isInstanceOf(OzoneDeskSmsService.SmsDeliveryException.class)
                .hasMessageContaining("SMS gateway rejected the request")
                // The gateway's own words, so the log says why rather than just "failed".
                .hasMessageContaining("Invalid API key");
        server.verify();
    }

    @Test
    void doesNotTreatAnEmptyErrorFieldAsAFailure() {
        // The old substring check flagged any body containing "error" — including the
        // empty error field a successful send comes back with, which turned every
        // delivered message into a logged failure.
        server.expect(once(), method(HttpMethod.POST))
                .andRespond(withSuccess("{\"status\":\"sent\",\"error\":null,\"errorCode\":0}",
                        MediaType.APPLICATION_JSON));

        service.sendSms("94702011540", "OTP 123456");

        server.verify();
    }

    @Test
    void reportsTheHttpStatusWhenTheGatewayIsDown() {
        server.expect(once(), method(HttpMethod.POST)).andRespond(withServerError());

        assertThatThrownBy(() -> service.sendSms("94702011540", "OTP 123456"))
                .isInstanceOf(OzoneDeskSmsService.SmsDeliveryException.class);
        server.verify();
    }

    @Test
    void rejectsABlankMessageWithoutCallingTheGateway() {
        assertThatThrownBy(() -> service.sendSms("0702011540", "   "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must not be blank");
        server.verify();
    }

    private static org.springframework.util.MultiValueMap<String, String> formOf(String... keyValues) {
        org.springframework.util.MultiValueMap<String, String> form =
                new org.springframework.util.LinkedMultiValueMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            form.add(keyValues[i], keyValues[i + 1]);
        }
        return form;
    }
}
