package com.uom.lims.api.dto.response;

public record InstrumentStatusResponse(
        String id,
        String name,
        String type,
        String model,
        String serial,
        String status,
        String lastSync,
        int testsToday,
        String location,
        String qcStatus) {
}
