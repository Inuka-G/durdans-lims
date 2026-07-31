package com.uom.lims.compliance;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Enforces the data-retention policy: periodically anonymises soft-deleted
 * patient records whose retention window has elapsed, so PII is not kept beyond
 * the legally-required period (PDPA storage-limitation principle).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RetentionScheduler {

    private final DataSubjectRequestService dsrService;

    @Value("${app.compliance.retention-days:2555}") // ~7 years
    private int retentionDays;

    /** Runs daily at 02:30. */
    @Scheduled(cron = "${app.compliance.retention-cron:0 30 2 * * *}")
    public void enforceRetention() {
        int count = dsrService.anonymizeExpired(retentionDays);
        if (count > 0) {
            log.info("Retention job anonymised {} record(s) past {} days", count, retentionDays);
        }
    }
}
