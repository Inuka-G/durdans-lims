package com.uom.lims.whatsapp.voice;

import com.uom.lims.whatsapp.agent.CoreCatalogClient;
import com.uom.lims.whatsapp.config.SecurityConfig;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(VoiceToolsController.class)
@Import({SecurityConfig.class, VoiceSpokenFormatter.class})
@TestPropertySource(properties = {
        "app.meta.app-secret=test-secret",
        "app.meta.verify-token=test-verify",
        "app.voice.internal-token=" + VoiceToolsControllerTest.TOKEN
})
class VoiceToolsControllerTest {

    static final String TOKEN = "test-internal-token-not-a-real-credential";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CoreCatalogClient catalog;

    @Test
    void rejectsAMissingToken() throws Exception {
        mockMvc.perform(post("/internal/voice/tools/search-tests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"fbc\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void rejectsAWrongToken() throws Exception {
        mockMvc.perform(post("/internal/voice/tools/order-status")
                        .header("X-Internal-Token", "guess")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderNo\":\"ORD-1\",\"callerWaId\":\"94770000001\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void searchReturnsSpokenSentencesForTheTopMatches() throws Exception {
        when(catalog.searchTests(anyString(), any())).thenReturn("""
                [{"testCode":"FBC","englishName":"Full Blood Count","testName":"සම්පූර්ණ රුධිර ගණනය",
                  "price":1200,"turnAroundTimeHours":24,"fastingRequired":false}]""");

        mockMvc.perform(post("/internal/voice/tools/search-tests")
                        .header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"fbc\",\"locale\":\"si\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.found").value(true))
                .andExpect(jsonPath("$.matches[0].testCode").value("FBC"))
                .andExpect(jsonPath("$.matches[0].spoken_en").value(
                        org.hamcrest.Matchers.containsString("rupees 1200")));
    }

    @Test
    void orderStatusInjectsTheCallerIdIntoThePossessionCheck() throws Exception {
        when(catalog.getOrderStatus("ORD-20260816-010000", "94770000001"))
                .thenReturn("{\"found\":true,\"stage\":\"PROCESSING\",\"reportReady\":false,"
                        + "\"totalTests\":2,\"testsCompleted\":0}");

        mockMvc.perform(post("/internal/voice/tools/order-status")
                        .header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderNo\":\"ORD-20260816-010000\",\"callerWaId\":\"94770000001\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.spoken_en").value(
                        org.hamcrest.Matchers.containsString("0 of 2")));
    }
}
