package com.uom.lims.api.superadmin.monitoring.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MetricDataResponse {
    private String timestamp;
    private Double value;
}
