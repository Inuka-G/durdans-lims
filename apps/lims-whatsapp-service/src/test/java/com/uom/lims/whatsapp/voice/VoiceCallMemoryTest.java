package com.uom.lims.whatsapp.voice;

import com.uom.lims.whatsapp.config.SecurityConfig;
import com.uom.lims.whatsapp.domain.WaContactEntity;
import com.uom.lims.whatsapp.domain.WaContactRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Both halves of caller memory. The behaviour worth pinning here is not that a string
 * round-trips — it is that the memory stays small, stays fresh, and never grows into a
 * transcript.
 */
@WebMvcTest({VoiceCallMemoryController.class, VoiceCallerProfileController.class})
@Import(SecurityConfig.class)
@TestPropertySource(properties = {
        "app.meta.app-secret=test-secret",
        "app.meta.verify-token=test-verify",
        "app.voice.internal-token=" + VoiceCallMemoryTest.TOKEN
})
class VoiceCallMemoryTest {

    static final String TOKEN = "test-internal-token-not-a-real-credential";
    private static final String WA_ID = "94713810137";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private WaContactRepository contacts;

    private WaContactEntity contact(String waId) {
        WaContactEntity contact = new WaContactEntity();
        contact.setWaId(waId);
        contact.setLocale("en");
        return contact;
    }

    @Test
    void rejectsAMissingTokenOnBothHalves() throws Exception {
        mockMvc.perform(post("/internal/voice/tools/call-memory")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerWaId\":\"" + WA_ID + "\",\"summary\":\"report status\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/internal/voice/tools/caller-profile")
                        .header("X-Internal-Token", "guess")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerWaId\":\"" + WA_ID + "\"}"))
                .andExpect(status().isForbidden());

        verify(contacts, never()).save(any());
    }

    @Test
    void storesTheTopicAndTheSpokenLanguageOnAnExistingContact() throws Exception {
        WaContactEntity existing = contact(WA_ID);
        when(contacts.findByWaId(WA_ID)).thenReturn(Optional.of(existing));

        mockMvc.perform(post("/internal/voice/tools/call-memory")
                        .header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerWaId\":\"" + WA_ID
                                + "\",\"summary\":\"report status\",\"locale\":\"si\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stored").value(true));

        ArgumentCaptor<WaContactEntity> saved = ArgumentCaptor.forClass(WaContactEntity.class);
        verify(contacts).save(saved.capture());
        assertThat(saved.getValue().getLastCallSummary()).isEqualTo("report status");
        assertThat(saved.getValue().getLastCallAt()).isNotNull();
        // The language they spoke beats the language they last typed.
        assertThat(saved.getValue().getLocale()).isEqualTo("si");
    }

    @Test
    void createsAContactForACallerWhoHasOnlyEverPhoned() throws Exception {
        when(contacts.findByWaId(WA_ID)).thenReturn(Optional.empty());
        when(contacts.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(post("/internal/voice/tools/call-memory")
                        .header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerWaId\":\"" + WA_ID
                                + "\",\"summary\":\"test prices (FBC)\",\"locale\":\"si\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stored").value(true));

        ArgumentCaptor<WaContactEntity> created = ArgumentCaptor.forClass(WaContactEntity.class);
        verify(contacts).saveAndFlush(created.capture());
        assertThat(created.getValue().getWaId()).isEqualTo(WA_ID);
    }

    @Test
    void aCallWithNoSubjectStoresNothing() throws Exception {
        mockMvc.perform(post("/internal/voice/tools/call-memory")
                        .header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerWaId\":\"" + WA_ID + "\",\"summary\":\"   \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stored").value(false));

        verify(contacts, never()).save(any());
    }

    @Test
    void scrubsControlCharactersAndCapsTheLength() throws Exception {
        WaContactEntity existing = contact(WA_ID);
        when(contacts.findByWaId(WA_ID)).thenReturn(Optional.of(existing));

        mockMvc.perform(post("/internal/voice/tools/call-memory")
                        .header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerWaId\":\"" + WA_ID + "\",\"summary\":\"report\\nstatus "
                                + "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                                + "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                                + "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}"))
                .andExpect(status().isOk());

        ArgumentCaptor<WaContactEntity> saved = ArgumentCaptor.forClass(WaContactEntity.class);
        verify(contacts).save(saved.capture());
        String stored = saved.getValue().getLastCallSummary();
        assertThat(stored).doesNotContain("\n").startsWith("report status ");
        assertThat(stored.length()).isEqualTo(180);
    }

    @Test
    void profileHandsBackARecentCallAsSomethingSpeakable() throws Exception {
        WaContactEntity existing = contact(WA_ID);
        existing.setDisplayName("Kalana");
        existing.setLocale("si");
        existing.setLastCallSummary("report status");
        existing.setLastCallAt(Instant.now().minus(Duration.ofDays(1)));
        when(contacts.findByWaId(WA_ID)).thenReturn(Optional.of(existing));

        mockMvc.perform(post("/internal/voice/tools/caller-profile")
                        .header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerWaId\":\"" + WA_ID + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.known").value(true))
                .andExpect(jsonPath("$.displayName").value("Kalana"))
                .andExpect(jsonPath("$.locale").value("si"))
                .andExpect(jsonPath("$.lastCallSummary").value("report status"))
                .andExpect(jsonPath("$.lastCallOn").value("yesterday"));
    }

    @Test
    void profileForgetsACallOlderThanTheHorizon() throws Exception {
        WaContactEntity existing = contact(WA_ID);
        existing.setLastCallSummary("report status");
        existing.setLastCallAt(Instant.now().minus(Duration.ofDays(120)));
        when(contacts.findByWaId(WA_ID)).thenReturn(Optional.of(existing));

        mockMvc.perform(post("/internal/voice/tools/caller-profile")
                        .header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerWaId\":\"" + WA_ID + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.known").value(true))
                .andExpect(jsonPath("$.lastCallSummary").doesNotExist())
                .andExpect(jsonPath("$.lastCallOn").doesNotExist());
    }

    @Test
    void anUnknownNumberIsSimplyUnknown() throws Exception {
        when(contacts.findByWaId(WA_ID)).thenReturn(Optional.empty());

        mockMvc.perform(post("/internal/voice/tools/caller-profile")
                        .header("X-Internal-Token", TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerWaId\":\"" + WA_ID + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.known").value(false))
                .andExpect(jsonPath("$.displayName").doesNotExist());
    }
}
