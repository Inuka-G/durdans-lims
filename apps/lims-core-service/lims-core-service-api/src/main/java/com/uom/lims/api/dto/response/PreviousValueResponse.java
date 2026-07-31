package com.uom.lims.api.dto.response;

import java.time.Instant;

/**
 * Prior authoritative result for the same patient and test (delta-check context).
 */
public record PreviousValueResponse(
        String result,
        String flag,
        Instant collectedAt,
        String sampleBarcode) {
}
