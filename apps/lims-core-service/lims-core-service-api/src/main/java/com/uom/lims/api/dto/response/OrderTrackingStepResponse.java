package com.uom.lims.api.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderTrackingStepResponse {
    private String key;
    private String label;
    private String status;
    private String timestamp;
    private String description;
}
