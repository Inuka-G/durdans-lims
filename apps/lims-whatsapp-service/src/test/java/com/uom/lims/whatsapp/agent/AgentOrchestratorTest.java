package com.uom.lims.whatsapp.agent;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.uom.lims.whatsapp.domain.MessageDirection;
import com.uom.lims.whatsapp.domain.WaMessageEntity;
import com.uom.lims.whatsapp.domain.WaMessageRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentOrchestratorTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Mock
    private GeminiClient gemini;

    @Mock
    private CoreCatalogClient catalog;

    @Mock
    private WaMessageRepository messageRepository;

    private AgentOrchestrator orchestrator() {
        return new AgentOrchestrator(AgentTestFixtures.configured(), gemini, catalog, messageRepository, mapper);
    }

    private static WaMessageEntity message(MessageDirection direction, String body) {
        WaMessageEntity entity = new WaMessageEntity();
        entity.setDirection(direction);
        entity.setBody(body);
        return entity;
    }

    private JsonNode json(String content) {
        try {
            return mapper.readTree(content);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException(e);
        }
    }

    @Test
    void runsTheToolLoopAndReturnsGroundedText() {
        UUID conversationId = UUID.randomUUID();
        when(messageRepository.findByConversation_IdOrderByCreatedAtDesc(any(), any()))
                .thenReturn(List.of(message(MessageDirection.INBOUND, "cbc eka kiyada?")));
        when(gemini.generate(any()))
                .thenReturn(json("""
                        {"role":"model","parts":[{"functionCall":{"name":"searchTests","args":{"query":"cbc","locale":"si"}}}]}"""))
                .thenReturn(json("""
                        {"role":"model","parts":[{"text":"FBC (Full Blood Count) - Rs. 1,200"}]}"""));
        when(catalog.searchTests("cbc", "si")).thenReturn("[{\"testCode\":\"FBC\",\"price\":1200}]");

        Optional<String> reply = orchestrator().reply(conversationId, "94770000001", null);

        assertThat(reply).contains("FBC (Full Blood Count) - Rs. 1,200");
        verify(catalog).searchTests("cbc", "si");

        // The second model call must carry the tool result back as a functionResponse.
        ArgumentCaptor<ObjectNode> captor = ArgumentCaptor.forClass(ObjectNode.class);
        verify(gemini, times(2)).generate(captor.capture());
        JsonNode secondRequest = captor.getAllValues().get(1);
        JsonNode lastTurn = secondRequest.path("contents").path(2);
        assertThat(lastTurn.path("role").asText()).isEqualTo("user");
        assertThat(lastTurn.path("parts").path(0).path("functionResponse").path("name").asText())
                .isEqualTo("searchTests");
    }

    @Test
    void givesUpAfterTheToolRoundCapRatherThanAnswerUngrounded() {
        UUID conversationId = UUID.randomUUID();
        when(messageRepository.findByConversation_IdOrderByCreatedAtDesc(any(), any()))
                .thenReturn(List.of(message(MessageDirection.INBOUND, "price?")));
        when(gemini.generate(any())).thenReturn(json("""
                {"role":"model","parts":[{"functionCall":{"name":"listPackages","args":{}}}]}"""));
        when(catalog.listPackages(null)).thenReturn("[]");

        assertThat(orchestrator().reply(conversationId, "94770000001", null)).isEmpty();
        // Default cap is 4 rounds; the loop runs cap+1 generate calls before giving up.
        verify(gemini, times(5)).generate(any());
    }

    @Test
    void anEmptyConversationNeverReachesTheModel() {
        when(messageRepository.findByConversation_IdOrderByCreatedAtDesc(any(), any()))
                .thenReturn(List.of(message(MessageDirection.INBOUND, null)));

        assertThat(orchestrator().reply(UUID.randomUUID(), "94770000001", null)).isEmpty();
        verifyNoInteractions(gemini);
    }

    @Test
    void orderStatusToolGetsTheWhatsAppSenderInjectedServerSide() {
        UUID conversationId = UUID.randomUUID();
        when(messageRepository.findByConversation_IdOrderByCreatedAtDesc(any(), any()))
                .thenReturn(List.of(message(MessageDirection.INBOUND, "ORD-20260820-000123 ready da?")));
        when(gemini.generate(any()))
                .thenReturn(json("""
                        {"role":"model","parts":[{"functionCall":{"name":"getOrderStatus","args":{"orderNo":"ORD-20260820-000123"}}}]}"""))
                .thenReturn(json("""
                        {"role":"model","parts":[{"text":"Your report is ready."}]}"""));
        when(catalog.getOrderStatus("ORD-20260820-000123", "94770000001"))
                .thenReturn("{\"found\":true,\"reportReady\":true}");

        assertThat(orchestrator().reply(conversationId, "94770000001", null)).contains("Your report is ready.");

        // The phone came from the conversation, not from the model's arguments.
        verify(catalog).getOrderStatus("ORD-20260820-000123", "94770000001");
    }

    @Test
    void historyIsSentChronologicallyWithRolesMapped() {
        UUID conversationId = UUID.randomUUID();
        // Repository returns newest first; the model must see oldest first.
        when(messageRepository.findByConversation_IdOrderByCreatedAtDesc(any(), any()))
                .thenReturn(List.of(
                        message(MessageDirection.INBOUND, "how much?"),
                        message(MessageDirection.OUTBOUND, "Hello!"),
                        message(MessageDirection.INBOUND, "hi")));
        when(gemini.generate(any())).thenReturn(json("{\"role\":\"model\",\"parts\":[{\"text\":\"answer\"}]}"));

        orchestrator().reply(conversationId, "94770000001", null);

        ArgumentCaptor<ObjectNode> captor = ArgumentCaptor.forClass(ObjectNode.class);
        verify(gemini).generate(captor.capture());
        JsonNode contents = captor.getValue().path("contents");
        assertThat(contents.path(0).path("role").asText()).isEqualTo("user");
        assertThat(contents.path(0).path("parts").path(0).path("text").asText()).isEqualTo("hi");
        assertThat(contents.path(1).path("role").asText()).isEqualTo("model");
        assertThat(contents.path(2).path("parts").path(0).path("text").asText()).isEqualTo("how much?");
    }
}
