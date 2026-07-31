package com.uom.lims.config;

import com.uom.lims.api.dispatch.enums.DispatchItemStatus;
import com.uom.lims.api.enums.CriticalNotificationStatus;
import com.uom.lims.dispatch.ReportDispatchItemRepository;
import com.uom.lims.notification.CriticalValueNotificationRepository;
import com.uom.lims.outbox.OutboxRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;
import java.util.List;

/**
 * Business-/clinical-safety metrics surfaced to Prometheus (G2/G3). Each gauge is bound
 * to a lightweight, indexed COUNT query evaluated at scrape time, so Alertmanager can
 * page on the things that are otherwise silent: a dead-lettered domain event, a critical
 * value that nobody has acknowledged within the SLA, or a failed report dispatch.
 */
@Configuration
@RequiredArgsConstructor
public class LimsMetricsConfig {

    private static final List<CriticalNotificationStatus> OPEN_CRITICAL = List.of(
            CriticalNotificationStatus.PENDING,
            CriticalNotificationStatus.NOTIFIED,
            CriticalNotificationStatus.ESCALATED);

    private final MeterRegistry registry;
    private final OutboxRepository outboxRepository;
    private final CriticalValueNotificationRepository criticalRepository;
    private final ReportDispatchItemRepository dispatchRepository;

    @PostConstruct
    void bindBusinessMetrics() {
        Gauge.builder("lims_outbox_dead_letter", outboxRepository, OutboxRepository::countByFailedAtIsNotNull)
                .description("Outbox events that exhausted retries (dead-letter) — a dropped domain event")
                .register(registry);

        Gauge.builder("lims_outbox_backlog", outboxRepository, OutboxRepository::countByPublishedAtIsNullAndFailedAtIsNull)
                .description("Unpublished outbox events awaiting delivery")
                .register(registry);

        Gauge.builder("lims_critical_open", criticalRepository, r -> r.countByStatusIn(OPEN_CRITICAL))
                .description("Open critical-value callbacks (not yet acknowledged or closed)")
                .register(registry);

        Gauge.builder("lims_critical_overdue", criticalRepository,
                        r -> r.countByStatusInAndNextEscalationDueAtBefore(OPEN_CRITICAL, Instant.now()))
                .description("Open critical-value callbacks past their acknowledgment SLA")
                .register(registry);

        Gauge.builder("lims_dispatch_failed", dispatchRepository,
                        r -> r.countByOverallStatusIn(List.of(DispatchItemStatus.FAILED)))
                .description("Report dispatch items in FAILED state")
                .register(registry);
    }
}
