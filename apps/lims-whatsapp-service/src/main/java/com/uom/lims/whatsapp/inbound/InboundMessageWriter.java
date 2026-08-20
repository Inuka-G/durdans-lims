package com.uom.lims.whatsapp.inbound;

import com.uom.lims.whatsapp.domain.ConversationState;
import com.uom.lims.whatsapp.domain.MessageDirection;
import com.uom.lims.whatsapp.domain.MessageStatus;
import com.uom.lims.whatsapp.domain.WaContactEntity;
import com.uom.lims.whatsapp.domain.WaContactRepository;
import com.uom.lims.whatsapp.domain.WaConversationEntity;
import com.uom.lims.whatsapp.domain.WaConversationRepository;
import com.uom.lims.whatsapp.domain.WaMessageEntity;
import com.uom.lims.whatsapp.domain.WaMessageRepository;
import com.uom.lims.whatsapp.reply.InboundMessageStoredEvent;
import com.uom.lims.whatsapp.util.PiiMasker;
import com.uom.lims.whatsapp.webhook.WebhookPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Persists one inbound message in its own transaction.
 *
 * <p>Separate from {@link InboundWebhookService} on purpose rather than for tidiness:
 * {@code REQUIRES_NEW} is applied by a Spring proxy, and a proxy is bypassed when a bean
 * calls its own method. Keeping the per-message transaction in a different bean is what
 * makes the boundary real, so one duplicate in a batch cannot roll back the messages
 * that arrived alongside it.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InboundMessageWriter {

    private final WaContactRepository contactRepository;
    private final WaConversationRepository conversationRepository;
    private final WaMessageRepository messageRepository;
    private final ApplicationEventPublisher events;

    /**
     * @return true if the message was newly stored, false if it was a redelivery
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean store(WebhookPayload.Message message, String displayName, String rawBody) {
        if (messageRepository.existsByWamid(message.id())) {
            log.debug("Ignoring redelivered message from {}", PiiMasker.maskWaId(message.from()));
            return false;
        }

        WaContactEntity contact = upsertContact(message.from(), displayName);
        WaConversationEntity conversation = openConversation(contact);
        Instant receivedAt = InboundWebhookService.parseTimestamp(message.timestamp());

        WaMessageEntity entity = new WaMessageEntity();
        entity.setConversation(conversation);
        entity.setDirection(MessageDirection.INBOUND);
        entity.setWamid(message.id());
        entity.setMessageType(message.type() == null ? "unknown" : message.type());
        entity.setBody(InboundWebhookService.extractBody(message));
        entity.setStatus(MessageStatus.RECEIVED);
        entity.setMetaTimestamp(receivedAt);
        entity.setRawPayload(rawBody);

        try {
            messageRepository.saveAndFlush(entity);
        } catch (DataIntegrityViolationException e) {
            // Two concurrent redeliveries of the same message. The unique index on wamid
            // is what makes this safe; the exists() check above only avoids the round
            // trip in the common case. Flushing here rather than at commit is what lets
            // us catch it as an ordinary duplicate instead of a failed transaction.
            log.debug("Concurrent redelivery rejected by the wamid constraint");
            return false;
        }

        conversation.registerInbound(receivedAt);
        conversationRepository.save(conversation);

        // Published inside this transaction so AFTER_COMMIT listeners fire only once the
        // message is durable. Replying is their problem; storing was ours.
        events.publishEvent(new InboundMessageStoredEvent(
                entity.getId(), conversation.getId(), message.from(),
                entity.getBody(), entity.getMessageType()));

        log.info("Stored inbound {} message from {} {}",
                entity.getMessageType(),
                PiiMasker.maskWaId(message.from()),
                PiiMasker.describeBody(entity.getBody()));
        return true;
    }

    private WaContactEntity upsertContact(String waId, String displayName) {
        WaContactEntity contact = contactRepository.findByWaId(waId)
                .orElseGet(() -> {
                    WaContactEntity fresh = new WaContactEntity();
                    fresh.setWaId(waId);
                    return fresh;
                });
        // Meta sends the current WhatsApp profile name on every delivery, so this keeps
        // up with a rename without a separate sync. It is never used for identification.
        if (displayName != null && !displayName.isBlank()) {
            contact.setDisplayName(displayName);
        }
        return contactRepository.save(contact);
    }

    private WaConversationEntity openConversation(WaContactEntity contact) {
        return conversationRepository
                .findFirstByContactAndStateNotOrderByCreatedAtDesc(contact, ConversationState.CLOSED)
                .orElseGet(() -> {
                    WaConversationEntity fresh = new WaConversationEntity();
                    fresh.setContact(contact);
                    fresh.setState(ConversationState.OPEN);
                    return conversationRepository.save(fresh);
                });
    }
}
