package com.uom.lims.whatsapp.outbound;

import com.uom.lims.whatsapp.domain.MessageDirection;
import com.uom.lims.whatsapp.domain.MessageStatus;
import com.uom.lims.whatsapp.domain.WaMessageEntity;
import com.uom.lims.whatsapp.domain.WaMessageRepository;
import com.uom.lims.whatsapp.util.PiiMasker;
import com.uom.lims.whatsapp.webhook.WebhookPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Applies Meta's delivery receipts to the outbound rows they belong to.
 *
 * <p>Statuses arrive out of order — a {@code read} can beat the {@code delivered} it
 * implies — so transitions are forward-only by rank rather than last-write-wins.
 * {@code REQUIRES_NEW} for the same reason as {@link
 * com.uom.lims.whatsapp.inbound.InboundMessageWriter}: one bad receipt in a batch must
 * not roll back the rest.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryStatusWriter {

    private final WaMessageRepository messageRepository;

    /**
     * @return true if a row was updated; false covers every ignorable case — unknown
     * wamid, unknown status string, out-of-order receipt — because a status we cannot
     * apply must still be acknowledged. A non-200 would make Meta redeliver a receipt
     * we will never be able to match, forever.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean apply(WebhookPayload.Status status) {
        if (status == null || status.id() == null || status.status() == null) {
            return false;
        }
        WaMessageEntity message = messageRepository.findByWamid(status.id()).orElse(null);
        if (message == null) {
            // Either a message sent outside this service, or the narrow send-then-crash
            // window OutboundMessageService documents. Worth a log line, not a failure.
            log.info("Delivery status '{}' for unknown wamid from {}",
                    status.status(), PiiMasker.maskWaId(status.recipientId()));
            return false;
        }
        if (message.getDirection() != MessageDirection.OUTBOUND) {
            log.warn("Delivery status addressed to an inbound message; ignoring");
            return false;
        }

        MessageStatus next = map(status.status());
        if (next == null) {
            log.debug("Ignoring unhandled delivery status '{}'", status.status());
            return false;
        }
        if (next == MessageStatus.FAILED) {
            message.setStatus(MessageStatus.FAILED);
            message.setFailureReason(summarize(status.errors()));
            messageRepository.save(message);
            log.warn("Outbound message to {} failed: {}",
                    PiiMasker.maskWaId(status.recipientId()), message.getFailureReason());
            return true;
        }
        if (rank(next) <= rank(message.getStatus())) {
            return false;
        }
        message.setStatus(next);
        messageRepository.save(message);
        return true;
    }

    private static MessageStatus map(String metaStatus) {
        return switch (metaStatus) {
            case "sent" -> MessageStatus.SENT;
            case "delivered" -> MessageStatus.DELIVERED;
            case "read" -> MessageStatus.READ;
            case "failed" -> MessageStatus.FAILED;
            default -> null;
        };
    }

    /** FAILED and RECEIVED rank highest so nothing ever "upgrades" over them. */
    private static int rank(MessageStatus status) {
        return switch (status) {
            case QUEUED -> 0;
            case SENT -> 1;
            case DELIVERED -> 2;
            case READ -> 3;
            default -> Integer.MAX_VALUE;
        };
    }

    private static String summarize(List<WebhookPayload.Error> errors) {
        if (errors == null || errors.isEmpty()) {
            return "failed (no error detail from Meta)";
        }
        String joined = errors.stream()
                .filter(e -> e != null)
                .map(e -> {
                    String details = e.errorData() == null ? null : e.errorData().details();
                    return (e.code() == null ? "?" : e.code()) + " " + (e.title() == null ? "" : e.title())
                            + (details == null ? "" : " — " + details);
                })
                .collect(Collectors.joining("; "));
        // Column is varchar(1024); Meta's detail strings are unbounded.
        return joined.length() > 1024 ? joined.substring(0, 1024) : joined;
    }
}
