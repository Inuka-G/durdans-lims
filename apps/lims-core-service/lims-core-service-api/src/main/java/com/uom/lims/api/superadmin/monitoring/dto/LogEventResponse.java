package com.uom.lims.api.superadmin.monitoring.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LogEventResponse {
    private String timestamp;
    private String message;
    private String level;
}
