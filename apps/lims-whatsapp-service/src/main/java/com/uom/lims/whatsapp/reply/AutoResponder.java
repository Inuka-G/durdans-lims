package com.uom.lims.whatsapp.reply;

import com.uom.lims.whatsapp.config.AsyncConfig;
import com.uom.lims.whatsapp.config.MetaProperties;
import com.uom.lims.whatsapp.outbound.OutboundMessageService;
import com.uom.lims.whatsapp.util.PiiMasker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Replies to a stored inbound message with the acknowledgement greeting.
 *
 * <p>{@code AFTER_COMMIT} plus {@code @Async} is the whole durability argument: this
 * runs only once the message row is committed, on a different thread, so nothing here —
 * not a Graph outage, not a bug — can delay or fail the webhook ack. A failure is
 * logged and abandoned; there is no retry, because the next inbound message effectively
 * is the retry.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AutoResponder {

    private final AutoReplyProperties properties;
    private final MetaProperties meta;
    private final OutboundMessageService outbound;

    @Async(AsyncConfig.REPLY_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onInboundStored(InboundMessageStoredEvent event) {
        if (!properties.enabled()) {
            return;
        }
        if (!meta.isSendConfigured()) {
            // The webhook can be live before send credentials are (they arrive in the
            // same secret, but a deployment can be half-rolled). Fail closed, quietly.
            log.debug("Send credentials not configured; skipping auto-reply");
            return;
        }
        try {
            outbound.sendAutoReplyIfDue(event.conversationId(), properties.greeting(), properties.cooldown())
                    .ifPresent(m -> log.info("Auto-acknowledged inbound message from {}",
                            PiiMasker.maskWaId(event.waId())));
        } catch (Exception e) {
            log.error("Auto-reply to {} failed", PiiMasker.maskWaId(event.waId()), e);
        }
    }
}
