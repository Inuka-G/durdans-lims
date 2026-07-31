package com.uom.lims.event;

import java.time.LocalDateTime;

public record ReportDispatchDomainEvent(
        String eventType,
        String reportReference,
        String branchCode,
        String overallStatus,
        LocalDateTime timestamp) {
}
