package com.uom.lims.event;

import com.uom.lims.outbox.OutboxService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Writes report-dispatch domain events to the transactional outbox.
 *
 * <p>Synchronous {@code @EventListener} so it runs inside the publishing
 * transaction — the event row commits atomically with the dispatch change and
 * the {@code OutboxRelay} delivers it to Kafka. (Was an AFTER_COMMIT direct send
 * that silently lost the event whenever the broker was unavailable.)
 */
@Component
@RequiredArgsConstructor
public class ReportDispatchOutboxListener {

    private static final String TOPIC = "report.dispatch.events";

    private final OutboxService outboxService;

    @EventListener
    public void onDispatchEvent(ReportDispatchDomainEvent event) {
        outboxService.append(
                "REPORT_DISPATCH",
                event.reportReference(),
                event.eventType(),
                TOPIC,
                event.reportReference(),
                event);
    }
}
