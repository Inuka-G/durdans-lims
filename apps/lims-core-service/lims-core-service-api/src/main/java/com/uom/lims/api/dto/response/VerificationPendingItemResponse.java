package com.uom.lims.api.dto.response;

import java.time.Instant;
import java.util.UUID;

public record VerificationPendingItemResponse(
        UUID sampleId,
        String barcode,
        UUID orderId,
        String patientId,
        String patientName,
        String testName,
        String priority,
        String status,
        String flag,
        String mltName,
        Instant submittedAt) {
}
