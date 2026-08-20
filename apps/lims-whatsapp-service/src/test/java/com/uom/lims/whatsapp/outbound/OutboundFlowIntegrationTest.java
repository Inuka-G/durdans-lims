package com.uom.lims.whatsapp.outbound;

import com.uom.lims.whatsapp.AbstractIntegrationTest;
import com.uom.lims.whatsapp.domain.MessageDirection;
import com.uom.lims.whatsapp.domain.MessageStatus;
import com.uom.lims.whatsapp.domain.WaContactEntity;
import com.uom.lims.whatsapp.domain.WaContactRepository;
import com.uom.lims.whatsapp.domain.WaConversationEntity;
import com.uom.lims.whatsapp.domain.WaConversationRepository;
import com.uom.lims.whatsapp.domain.WaMessageEntity;
import com.uom.lims.whatsapp.domain.WaMessageRepository;
import com.uom.lims.whatsapp.inbound.InboundWebhookService;
import com.uom.lims.whatsapp.webhook.WebhookPayload;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The pieces of the outbound path that only a real Postgres can prove: the atomic
 * cooldown claim (an UPDATE whose row-matching is the concurrency mechanism) and the
 * delivery-status lifecycle against real persisted rows. The Graph client is the one
 * thing mocked — this suite must run without Meta credentials.
 */
class OutboundFlowIntegrationTest extends AbstractIntegrationTest {

    @MockitoBean
    private MetaSendClient sendClient;

    @Autowired
    private OutboundMessageService outbound;

    @Autowired
    private InboundWebhookService inboundService;

    @Autowired
    private WaContactRepository contactRepository;

    @Autowired
    private WaConversationRepository conversationRepository;

    @Autowired
    private WaMessageRepository messageRepository;

    private WaConversationEntity conversationFor(String waId, boolean windowOpen) {
        WaContactEntity contact = new WaContactEntity();
        contact.setWaId(waId);
        contact = contactRepository.save(contact);

        WaConversationEntity conversation = new WaConversationEntity();
        conversation.setContact(contact);
        if (windowOpen) {
            conversation.registerInbound(Instant.now());
        }
        return conversationRepository.save(conversation);
    }

    private WaMessageEntity outboundRow(WaConversationEntity conversation, String wamid) {
        WaMessageEntity message = new WaMessageEntity();
        message.setConversation(conversation);
        message.setDirection(MessageDirection.OUTBOUND);
        message.setWamid(wamid);
        message.setMessageType("text");
        message.setBody("greeting");
        message.setStatus(MessageStatus.SENT);
        message.setMetaTimestamp(Instant.now());
        return messageRepository.save(message);
    }

    private static WebhookPayload statusPayload(WebhookPayload.Status status) {
        WebhookPayload.Value value = new WebhookPayload.Value(
                "whatsapp",
                new WebhookPayload.Metadata("+94112345678", "phone-id"),
                null, null, List.of(status));
        return new WebhookPayload("whatsapp_business_account",
                List.of(new WebhookPayload.Entry("waba-id",
                        List.of(new WebhookPayload.Change("messages", value)))));
    }

    private static WebhookPayload.Status receipt(String wamid, String status) {
        return new WebhookPayload.Status(wamid, status, "1750000000", "94770010001", null);
    }

    @Test
    void cooldownClaimAllowsExactlyOneGreeting() {
        WaConversationEntity conversation = conversationFor("94770010001", true);
        when(sendClient.sendText(anyString(), anyString())).thenReturn("wamid.it-greet-1");

        assertThat(outbound.sendAutoReplyIfDue(conversation.getId(), "hi", Duration.ofHours(1))).isPresent();
        assertThat(outbound.sendAutoReplyIfDue(conversation.getId(), "hi", Duration.ofHours(1))).isEmpty();

        verify(sendClient, times(1)).sendText(anyString(), anyString());
    }

    @Test
    void closedWindowRefusesTheSendEntirely() {
        WaConversationEntity conversation = conversationFor("94770010002", false);

        assertThat(outbound.sendAutoReplyIfDue(conversation.getId(), "hi", Duration.ofHours(1))).isEmpty();
        assertThat(outbound.sendFreeFormText(conversation.getId(), "hi")).isEmpty();

        verifyNoInteractions(sendClient);
    }

    @Test
    void deliveryReceiptsWalkTheLifecycleForwardOnly() {
        WaConversationEntity conversation = conversationFor("94770010003", true);
        WaMessageEntity message = outboundRow(conversation, "wamid.it-status-1");

        assertThat(inboundService.ingest(statusPayload(receipt("wamid.it-status-1", "delivered")), "{}")).isZero();
        assertThat(messageRepository.findById(message.getId()).orElseThrow().getStatus())
                .isEqualTo(MessageStatus.DELIVERED);

        inboundService.ingest(statusPayload(receipt("wamid.it-status-1", "read")), "{}");
        assertThat(messageRepository.findById(message.getId()).orElseThrow().getStatus())
                .isEqualTo(MessageStatus.READ);

        // A late redelivery of "delivered" must not walk READ backwards.
        inboundService.ingest(statusPayload(receipt("wamid.it-status-1", "delivered")), "{}");
        assertThat(messageRepository.findById(message.getId()).orElseThrow().getStatus())
                .isEqualTo(MessageStatus.READ);
    }

    @Test
    void failedReceiptRecordsMetasReason() {
        WaConversationEntity conversation = conversationFor("94770010004", true);
        WaMessageEntity message = outboundRow(conversation, "wamid.it-status-2");

        WebhookPayload.Status failed = new WebhookPayload.Status(
                "wamid.it-status-2", "failed", "1750000000", "94770010004",
                List.of(new WebhookPayload.Error(131047, "Re-engagement message",
                        "More than 24 hours have passed",
                        new WebhookPayload.ErrorData("Customer service window expired"))));
        inboundService.ingest(statusPayload(failed), "{}");

        WaMessageEntity reloaded = messageRepository.findById(message.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(MessageStatus.FAILED);
        assertThat(reloaded.getFailureReason()).contains("131047").contains("window expired");
    }

    @Test
    void receiptForAnUnknownWamidIsAcknowledgedNotRetriedForever() {
        assertThat(inboundService.ingest(statusPayload(receipt("wamid.it-unknown", "delivered")), "{}"))
                .isZero();
    }
}
