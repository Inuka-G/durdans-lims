package com.uom.lims.event;

import com.uom.lims.outbox.OutboxService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Writes patient domain events to the transactional outbox.
 *
 * <p>This is a plain (synchronous) {@code @EventListener}, so it runs inside the
 * publishing service's transaction. The outbox append therefore commits
 * atomically with the patient change; the {@code OutboxRelay} then delivers it
 * to Kafka. (Previously this published directly to Kafka AFTER_COMMIT, which
 * silently lost the event whenever the broker was unavailable.)
 */
@Component
@RequiredArgsConstructor
public class PatientEventOutboxListener {

    private static final String TOPIC = "patient.events";

    private final OutboxService outboxService;

    @EventListener
    public void onPatientEvent(PatientDomainEvent event) {
        outboxService.append(
                "PATIENT",
                event.patientCode(),
                event.eventType(),
                TOPIC,
                event.patientCode(),
                event);
    }
}
