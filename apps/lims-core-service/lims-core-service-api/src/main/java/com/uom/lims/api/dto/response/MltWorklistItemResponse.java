package com.uom.lims.api.dto.response;

import java.time.Instant;
import java.util.UUID;

public record MltWorklistItemResponse(
        UUID sampleId,
        String barcode,
        String orderId,
        UUID orderItemId,
        String patientId,
        String testName,
        String priority,
        String status,
        Instant collectedAt) {
}
