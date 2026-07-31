package com.uom.lims.event;

import com.uom.lims.api.dispatch.dto.request.RegisterAuthorizedReportRequest;

public record ClinicalReportAuthorizedEvent(
        RegisterAuthorizedReportRequest request,
        String auditSource
) {
}
