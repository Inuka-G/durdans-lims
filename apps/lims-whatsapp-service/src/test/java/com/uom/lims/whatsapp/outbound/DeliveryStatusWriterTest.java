package com.uom.lims.whatsapp.outbound;

import com.uom.lims.whatsapp.domain.MessageDirection;
import com.uom.lims.whatsapp.domain.MessageStatus;
import com.uom.lims.whatsapp.domain.WaMessageEntity;
import com.uom.lims.whatsapp.domain.WaMessageRepository;
import com.uom.lims.whatsapp.webhook.WebhookPayload;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryStatusWriterTest {

    @Mock
    private WaMessageRepository messageRepository;

    @InjectMocks
    private DeliveryStatusWriter writer;

    private static WaMessageEntity outbound(MessageStatus status) {
        WaMessageEntity message = new WaMessageEntity();
        message.setDirection(MessageDirection.OUTBOUND);
        message.setWamid("wamid.OUT");
        message.setStatus(status);
        return message;
    }

    private static WebhookPayload.Status receipt(String status) {
        return new WebhookPayload.Status("wamid.OUT", status, "1750000000", "94771234567", null);
    }

    @Test
    void upgradesSentToDelivered() {
        WaMessageEntity message = outbound(MessageStatus.SENT);
        when(messageRepository.findByWamid("wamid.OUT")).thenReturn(Optional.of(message));

        assertThat(writer.apply(receipt("delivered"))).isTrue();
        assertThat(message.getStatus()).isEqualTo(MessageStatus.DELIVERED);
        verify(messageRepository).save(message);
    }

    @Test
    void neverDowngradesReadToDelivered() {
        // Meta delivers receipts out of order; a late "delivered" must not erase "read".
        WaMessageEntity message = outbound(MessageStatus.READ);
        when(messageRepository.findByWamid("wamid.OUT")).thenReturn(Optional.of(message));

        assertThat(writer.apply(receipt("delivered"))).isFalse();
        assertThat(message.getStatus()).isEqualTo(MessageStatus.READ);
        verify(messageRepository, never()).save(any());
    }

    @Test
    void failedRecordsTheReasonFromMetaErrors() {
        WaMessageEntity message = outbound(MessageStatus.SENT);
        when(messageRepository.findByWamid("wamid.OUT")).thenReturn(Optional.of(message));

        WebhookPayload.Status failed = new WebhookPayload.Status(
                "wamid.OUT", "failed", "1750000000", "94771234567",
                List.of(new WebhookPayload.Error(131047, "Re-engagement message",
                        "More than 24 hours have passed since the customer last replied",
                        new WebhookPayload.ErrorData("Customer service window expired"))));

        assertThat(writer.apply(failed)).isTrue();
        assertThat(message.getStatus()).isEqualTo(MessageStatus.FAILED);
        assertThat(message.getFailureReason())
                .contains("131047")
                .contains("window expired");
    }

    @Test
    void unknownWamidIsIgnoredNotFailed() {
        when(messageRepository.findByWamid("wamid.OUT")).thenReturn(Optional.empty());

        assertThat(writer.apply(receipt("delivered"))).isFalse();
        verify(messageRepository, never()).save(any());
    }

    @Test
    void receiptAddressedToAnInboundMessageIsIgnored() {
        WaMessageEntity inbound = outbound(MessageStatus.RECEIVED);
        inbound.setDirection(MessageDirection.INBOUND);
        when(messageRepository.findByWamid("wamid.OUT")).thenReturn(Optional.of(inbound));

        assertThat(writer.apply(receipt("delivered"))).isFalse();
        verify(messageRepository, never()).save(any());
    }

    @Test
    void unhandledStatusStringsAreIgnored() {
        WaMessageEntity message = outbound(MessageStatus.SENT);
        when(messageRepository.findByWamid("wamid.OUT")).thenReturn(Optional.of(message));

        assertThat(writer.apply(receipt("warning"))).isFalse();
        assertThat(message.getStatus()).isEqualTo(MessageStatus.SENT);
    }
}
