package com.uom.lims.api.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SampleResultsResponse(
        UUID sampleId,
        String barcode,
        UUID orderId,
        String orderNo,
        UUID orderItemId,
        String patientId,
        String patientName,
        String testName,
        String status,
        String tubeType,
        String priority,
        Instant collectedAt,
        String collectedBy,
        List<ResultParameterResponse> results,
        String mltNotes,
        /** True while the supervisor has sent this case back to the MLT for re-run / re-entry. */
        boolean returnedToMlt,
        String returnReason,
        String returnedBy,
        Instant returnedAt) {
}
