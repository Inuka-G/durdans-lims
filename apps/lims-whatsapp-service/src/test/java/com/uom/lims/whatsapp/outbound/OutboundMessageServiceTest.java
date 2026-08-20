package com.uom.lims.whatsapp.outbound;

import com.uom.lims.whatsapp.domain.MessageDirection;
import com.uom.lims.whatsapp.domain.MessageStatus;
import com.uom.lims.whatsapp.domain.WaContactEntity;
import com.uom.lims.whatsapp.domain.WaConversationEntity;
import com.uom.lims.whatsapp.domain.WaConversationRepository;
import com.uom.lims.whatsapp.domain.WaMessageEntity;
import com.uom.lims.whatsapp.domain.WaMessageRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OutboundMessageServiceTest {

    @Mock
    private MetaSendClient sendClient;

    @Mock
    private WaMessageRepository messageRepository;

    @Mock
    private WaConversationRepository conversationRepository;

    @InjectMocks
    private OutboundMessageService service;

    private final UUID conversationId = UUID.randomUUID();

    private WaConversationEntity conversationWithOpenWindow() {
        WaContactEntity contact = new WaContactEntity();
        contact.setWaId("94770000001");
        WaConversationEntity conversation = new WaConversationEntity();
        conversation.setContact(contact);
        conversation.registerInbound(Instant.now());
        return conversation;
    }

    @Test
    void refusesFreeFormSendWhenWindowIsClosed() {
        WaContactEntity contact = new WaContactEntity();
        contact.setWaId("94770000001");
        WaConversationEntity closed = new WaConversationEntity();
        closed.setContact(contact);
        // No inbound ever registered: windowExpiresAt is null, the window never opened.
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(closed));

        assertThat(service.sendFreeFormText(conversationId, "hello")).isEmpty();
        verifyNoInteractions(sendClient);
        verify(messageRepository, never()).save(any());
    }

    @Test
    void sendsPersistsAndRegistersOutboundWhenWindowIsOpen() {
        WaConversationEntity conversation = conversationWithOpenWindow();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
        when(sendClient.sendText("94770000001", "hello")).thenReturn("wamid.NEW");

        Optional<WaMessageEntity> result = service.sendFreeFormText(conversationId, "hello");

        assertThat(result).isPresent();
        ArgumentCaptor<WaMessageEntity> captor = ArgumentCaptor.forClass(WaMessageEntity.class);
        verify(messageRepository).save(captor.capture());
        WaMessageEntity saved = captor.getValue();
        assertThat(saved.getDirection()).isEqualTo(MessageDirection.OUTBOUND);
        assertThat(saved.getWamid()).isEqualTo("wamid.NEW");
        assertThat(saved.getStatus()).isEqualTo(MessageStatus.SENT);
        assertThat(saved.getBody()).isEqualTo("hello");
        assertThat(conversation.getLastOutboundAt()).isNotNull();
    }

    @Test
    void autoReplyIsSuppressedWhenTheCooldownClaimFails() {
        WaConversationEntity conversation = conversationWithOpenWindow();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
        when(conversationRepository.claimAutoReply(any(), any(), any())).thenReturn(0);

        assertThat(service.sendAutoReplyIfDue(conversationId, "hi", Duration.ofHours(1))).isEmpty();
        verifyNoInteractions(sendClient);
    }

    @Test
    void autoReplySendsWhenTheClaimIsWon() {
        WaConversationEntity conversation = conversationWithOpenWindow();
        when(conversationRepository.findById(conversationId)).thenReturn(Optional.of(conversation));
        when(conversationRepository.claimAutoReply(any(), any(), any())).thenReturn(1);
        when(sendClient.sendText(anyString(), anyString())).thenReturn("wamid.GREET");

        Optional<WaMessageEntity> result = service.sendAutoReplyIfDue(conversationId, "hi", Duration.ofHours(1));

        assertThat(result).isPresent();
        assertThat(result.get().getWamid()).isEqualTo("wamid.GREET");
    }
}
