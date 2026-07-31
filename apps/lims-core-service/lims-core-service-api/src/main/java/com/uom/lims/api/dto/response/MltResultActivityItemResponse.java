package com.uom.lims.api.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record MltResultActivityItemResponse(
        UUID id,
        String action,
        String performedBy,
        LocalDateTime timestamp,
        String details) {
}
