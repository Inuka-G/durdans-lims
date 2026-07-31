package com.uom.lims.api.dto.response;

import java.time.Instant;
import java.util.UUID;

public record MltAllWorklistItemResponse(
        UUID sampleId,
        String barcode,
        String orderId,
        String patientId,
        String patientName,
        String testName,
        String department,
        String priority,
        String status,
        Instant collectedAt) {
}
