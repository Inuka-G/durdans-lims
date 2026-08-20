package com.uom.lims.whatsapp.outbound;

import com.uom.lims.whatsapp.domain.MessageDirection;
import com.uom.lims.whatsapp.domain.MessageStatus;
import com.uom.lims.whatsapp.domain.WaConversationEntity;
import com.uom.lims.whatsapp.domain.WaConversationRepository;
import com.uom.lims.whatsapp.domain.WaMessageEntity;
import com.uom.lims.whatsapp.domain.WaMessageRepository;
import com.uom.lims.whatsapp.util.PiiMasker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Policy and persistence for outbound messages. Every send passes through here so the
 * 24-hour window is enforced in exactly one place, per the design principle that rules
 * live next to the data rather than in a prompt.
 *
 * <p>The row is written after the Graph call, not before: {@code wamid} is NOT NULL
 * UNIQUE and only Meta can mint one. The narrow failure window that leaves — sent but
 * crashed before commit — loses the record of a greeting, not the greeting itself, and
 * the delivery status webhook for an unknown wamid is logged, which is the audit trail
 * for exactly that case.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OutboundMessageService {

    private final MetaSendClient sendClient;
    private final WaMessageRepository messageRepository;
    private final WaConversationRepository conversationRepository;

    /**
     * Sends free-form text if the service window is open. Outside the window this
     * refuses and returns empty — the caller falls back to a template (a later phase)
     * rather than sending anyway and letting Meta reject it invisibly.
     */
    @Transactional
    public Optional<WaMessageEntity> sendFreeFormText(UUID conversationId, String body) {
        WaConversationEntity conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new MetaSendException("No conversation " + conversationId));
        Instant now = Instant.now();
        if (!conversation.canSendFreeForm(now)) {
            log.info("Service window closed; refusing free-form send on conversation {}", conversationId);
            return Optional.empty();
        }
        return Optional.of(deliver(conversation, body, now));
    }

    /**
     * The auto-acknowledgement path: same as {@link #sendFreeFormText} but gated by an
     * atomic per-conversation cooldown claim, so a burst of inbound messages produces
     * one greeting instead of one per message. A send failure rolls the claim back,
     * which is what lets the next inbound message try again.
     */
    @Transactional
    public Optional<WaMessageEntity> sendAutoReplyIfDue(UUID conversationId, String body, Duration cooldown) {
        WaConversationEntity conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new MetaSendException("No conversation " + conversationId));
        Instant now = Instant.now();
        if (!conversation.canSendFreeForm(now)) {
            log.debug("Service window closed; skipping auto-reply on conversation {}", conversationId);
            return Optional.empty();
        }
        if (conversationRepository.claimAutoReply(conversationId, now, now.minus(cooldown)) == 0) {
            log.debug("Auto-reply suppressed by cooldown on conversation {}", conversationId);
            return Optional.empty();
        }
        return Optional.of(deliver(conversation, body, now));
    }

    private WaMessageEntity deliver(WaConversationEntity conversation, String body, Instant now) {
        String waId = conversation.getContact().getWaId();
        String wamid = sendClient.sendText(waId, body);

        WaMessageEntity message = new WaMessageEntity();
        message.setConversation(conversation);
        message.setDirection(MessageDirection.OUTBOUND);
        message.setWamid(wamid);
        message.setMessageType("text");
        message.setBody(body);
        message.setStatus(MessageStatus.SENT);
        message.setMetaTimestamp(now);
        messageRepository.save(message);

        conversation.registerOutbound(now);
        conversationRepository.save(conversation);

        log.info("Sent free-form text to {} {}", PiiMasker.maskWaId(waId), PiiMasker.describeBody(body));
        return message;
    }
}
