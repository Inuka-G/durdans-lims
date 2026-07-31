package com.uom.lims.outbox;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * One row of the transactional outbox. Written in the same transaction as the
 * business change; the {@link OutboxRelay} publishes it to Kafka and stamps
 * {@code publishedAt}.
 */
@Entity
@Table(name = "outbox_event")
@Getter
@Setter
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "aggregate_type", nullable = false, length = 64)
    private String aggregateType;

    @Column(name = "aggregate_id", nullable = false, length = 128)
    private String aggregateId;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(name = "topic", nullable = false, length = 128)
    private String topic;

    @Column(name = "message_key", length = 128)
    private String messageKey;

    @Column(name = "payload", nullable = false)
    private String payload;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "attempts", nullable = false)
    private int attempts = 0;

    /** Set once the max retry count is exceeded — the row is then excluded from the relay. */
    @Column(name = "failed_at")
    private Instant failedAt;

    /** W3C traceparent of the request that wrote this row, re-attached on publish (G6). */
    @Column(name = "traceparent", length = 64)
    private String traceparent;
}
