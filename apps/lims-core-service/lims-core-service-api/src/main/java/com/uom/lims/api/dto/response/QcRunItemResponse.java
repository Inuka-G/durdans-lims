package com.uom.lims.api.dto.response;

public record QcRunItemResponse(
        String id,
        String instrument,
        String testGroup,
        String level,
        String result,
        String expected,
        String sd,
        String status,
        String performedBy,
        String timestamp) {
}
