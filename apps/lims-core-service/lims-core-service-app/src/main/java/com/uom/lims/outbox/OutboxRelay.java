package com.uom.lims.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Polls the outbox and publishes pending events to Kafka.
 *
 * <p>The Kafka send happens OUTSIDE any database transaction; only the per-row
 * status update is transactional. This avoids holding a DB connection (and, in
 * the previous version, pessimistic row locks) across a slow broker send for a
 * whole batch. A failed send increments the attempt count; once it exceeds the
 * cap the row is stamped {@code failed_at} (dead-letter) so it is no longer
 * retried and can be surfaced to ops — the queue never grows unbounded behind a
 * poison event. Delivery is at-least-once; consumers are idempotent.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OutboxRelay {

    private static final int BATCH_SIZE = 50;
    private static final int MAX_ATTEMPTS = 10;
    private static final long SEND_TIMEOUT_SECONDS = 5;

    private final OutboxRepository repository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;

    // Self-proxy so the per-row transactional update is honoured when called from
    // the non-transactional poll loop.
    @Autowired
    @Lazy
    private OutboxRelay self;

    @Scheduled(fixedDelayString = "${app.outbox.poll-interval-ms:2000}")
    public void publishPending() {
        List<OutboxEvent> batch = repository
                .findByPublishedAtIsNullAndFailedAtIsNullOrderByCreatedAtAsc(PageRequest.of(0, BATCH_SIZE));
        for (OutboxEvent event : batch) {
            boolean sent = false;
            try {
                Object payload = objectMapper.readTree(event.getPayload());
                org.apache.kafka.clients.producer.ProducerRecord<String, Object> record =
                        new org.apache.kafka.clients.producer.ProducerRecord<>(
                                event.getTopic(), event.getMessageKey(), payload);
                // G6: re-attach the originating request's trace so the consumer continues
                // the same trace across the async outbox hop.
                if (event.getTraceparent() != null && !event.getTraceparent().isBlank()) {
                    record.headers().add("traceparent",
                            event.getTraceparent().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                }
                kafkaTemplate.send(record).get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
                sent = true;
            } catch (Exception e) {
                log.warn("Outbox publish failed for event {} — will retry", event.getId(), e);
            }
            self.recordOutcome(event.getId(), sent);
        }
    }

    /** Short transaction per row: mark published, or increment attempts / dead-letter. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordOutcome(UUID eventId, boolean sent) {
        OutboxEvent event = repository.findById(eventId).orElse(null);
        if (event == null || event.getPublishedAt() != null) {
            return;
        }
        if (sent) {
            event.setPublishedAt(Instant.now());
        } else {
            event.setAttempts(event.getAttempts() + 1);
            if (event.getAttempts() >= MAX_ATTEMPTS) {
                event.setFailedAt(Instant.now());
                log.error("Outbox event {} exhausted {} attempts — marked dead-letter",
                        eventId, MAX_ATTEMPTS);
            }
        }
    }
}
