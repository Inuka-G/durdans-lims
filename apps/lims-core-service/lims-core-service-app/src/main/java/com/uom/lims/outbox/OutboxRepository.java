package com.uom.lims.outbox;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OutboxRepository extends JpaRepository<OutboxEvent, UUID> {

    /**
     * Pending events oldest-first, excluding ones that have exhausted their
     * retries (failed_at set). No pessimistic lock: the relay sends OUTSIDE a
     * transaction and updates each row in its own short transaction, so it must
     * not hold row locks across the (slow) Kafka send. Delivery is at-least-once
     * and consumers are idempotent, so an occasional duplicate is acceptable.
     */
    List<OutboxEvent> findByPublishedAtIsNullAndFailedAtIsNullOrderByCreatedAtAsc(Pageable pageable);

    /** Dead-lettered events (retries exhausted) — surfaced as the lims_outbox_dead_letter metric (G2). */
    long countByFailedAtIsNotNull();

    /** Unpublished backlog awaiting delivery — lims_outbox_backlog metric (G2). */
    long countByPublishedAtIsNullAndFailedAtIsNull();
}
