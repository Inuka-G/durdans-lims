package com.uom.lims.outbox;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Appends events to the transactional outbox. {@code Propagation.MANDATORY}
 * guarantees the append happens inside the caller's business transaction — the
 * whole point of the outbox is that the event row and the business change commit
 * (or roll back) atomically.
 */
@Service
@RequiredArgsConstructor
public class OutboxService {

    private final OutboxRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void append(String aggregateType, String aggregateId, String eventType,
                       String topic, String messageKey, Object payload) {
        OutboxEvent event = new OutboxEvent();
        event.setAggregateType(aggregateType);
        event.setAggregateId(aggregateId);
        event.setEventType(eventType);
        event.setTopic(topic);
        event.setMessageKey(messageKey);
        try {
            event.setPayload(objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Cannot serialize outbox payload for " + eventType, e);
        }
        // G6: stamp the current trace so the relay can continue it on publish.
        event.setTraceparent(com.uom.lims.util.TraceContext.currentTraceparent());
        repository.save(event);
    }
}
