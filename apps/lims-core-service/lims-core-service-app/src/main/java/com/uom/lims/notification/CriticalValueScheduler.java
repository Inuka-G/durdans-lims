package com.uom.lims.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Drives the critical-value callback workflow off the request/business thread (H1):
 * delivers freshly opened callbacks and escalates those that pass their SLA without
 * acknowledgment. Mirrors the OutboxRelay poll-loop discipline (bounded batch, per-row
 * REQUIRES_NEW updates inside the service). Disabled in tests so the suite can drive
 * delivery/escalation deterministically.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.critical.scheduler-enabled", havingValue = "true", matchIfMissing = true)
public class CriticalValueScheduler {

    private static final int BATCH = 50;

    private final CriticalValueNotificationService service;

    @Scheduled(fixedDelayString = "${app.critical.poll-interval-ms:60000}")
    public void tick() {
        List<CriticalValueNotification> pending = service.dueForInitialSend(BATCH);
        for (CriticalValueNotification n : pending) {
            service.deliverInitial(n);
        }

        List<CriticalValueNotification> overdue = service.dueForEscalation(Instant.now(), BATCH);
        for (CriticalValueNotification n : overdue) {
            service.escalate(n);
        }
    }
}
