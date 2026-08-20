package com.uom.lims.whatsapp.webhook;

import com.uom.lims.whatsapp.config.SecurityConfig;
import com.uom.lims.whatsapp.inbound.InboundWebhookService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WebhookController.class)
@Import(SecurityConfig.class)
// Binds the single MetaProperties bean the application class already declares. Defining
// another one here would give the controller two candidates and fail the context.
@TestPropertySource(properties = {
        "app.meta.app-id=app-id",
        "app.meta.app-secret=app-secret",
        "app.meta.verify-token=" + WebhookControllerTest.VERIFY_TOKEN,
        "app.meta.phone-number-id=phone-id",
        "app.meta.business-account-id=waba-id",
        "app.meta.access-token=token"
})
class WebhookControllerTest {

    // Low-entropy on purpose; see MetaSignatureVerifierTest. The real token is 32 random
    // bytes supplied through the environment.
    static final String VERIFY_TOKEN = "test-verify-token-not-a-real-credential";

    private static final String VALID_BODY = """
            {"object":"whatsapp_business_account","entry":[{"id":"1","changes":[]}]}""";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MetaSignatureVerifier signatureVerifier;

    @MockitoBean
    private InboundWebhookService inboundService;

    @Test
    void echoesTheChallengeWhenTheVerifyTokenMatches() throws Exception {
        mockMvc.perform(get("/webhook/whatsapp")
                        .param("hub.mode", "subscribe")
                        .param("hub.verify_token", VERIFY_TOKEN)
                        .param("hub.challenge", "1158201444"))
                .andExpect(status().isOk())
                .andExpect(content().string("1158201444"));
    }

    @Test
    void refusesTheHandshakeWithAWrongVerifyToken() throws Exception {
        mockMvc.perform(get("/webhook/whatsapp")
                        .param("hub.mode", "subscribe")
                        .param("hub.verify_token", "wrong")
                        .param("hub.challenge", "1158201444"))
                .andExpect(status().isForbidden());
    }

    @Test
    void refusesTheHandshakeForAnUnexpectedMode() throws Exception {
        mockMvc.perform(get("/webhook/whatsapp")
                        .param("hub.mode", "unsubscribe")
                        .param("hub.verify_token", VERIFY_TOKEN)
                        .param("hub.challenge", "1158201444"))
                .andExpect(status().isForbidden());
    }

    /** An unsigned or badly signed delivery must never reach the ingest path. */
    @Test
    void rejectsADeliveryWithAnInvalidSignature() throws Exception {
        when(signatureVerifier.isValid(any(), any())).thenReturn(false);

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", "sha256=deadbeef")
                        .content(VALID_BODY))
                .andExpect(status().isForbidden());

        verify(inboundService, never()).ingest(any(), anyString());
    }

    @Test
    void ingestsASignedDelivery() throws Exception {
        when(signatureVerifier.isValid(any(), any())).thenReturn(true);

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", "sha256=whatever")
                        .content(VALID_BODY))
                .andExpect(status().isOk());

        verify(inboundService).ingest(any(WebhookPayload.class), anyString());
    }

    /**
     * A signed body we cannot parse is acknowledged, not retried. Returning non-200
     * would make Meta redeliver the same unparseable payload until it disables the
     * subscription, which would take every other patient's messages down with it.
     */
    @Test
    void acknowledgesASignedButUnparseableBody() throws Exception {
        when(signatureVerifier.isValid(any(), any())).thenReturn(true);

        mockMvc.perform(post("/webhook/whatsapp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Hub-Signature-256", "sha256=whatever")
                        .content("{ this is not json"))
                .andExpect(status().isOk());

        verify(inboundService, never()).ingest(any(), anyString());
    }
}
