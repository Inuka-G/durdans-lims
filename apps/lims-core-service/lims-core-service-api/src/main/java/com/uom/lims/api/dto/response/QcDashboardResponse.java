package com.uom.lims.api.dto.response;

import java.util.List;

public record QcDashboardResponse(
        int totalRuns,
        int passed,
        int warnings,
        int failures,
        List<QcRunItemResponse> runs) {
}
