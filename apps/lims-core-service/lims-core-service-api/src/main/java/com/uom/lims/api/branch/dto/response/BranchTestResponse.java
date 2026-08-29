package com.uom.lims.api.branch.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class BranchTestResponse {
    private UUID id;
    private String testName;
    private String testCode;
    private String category;
    private BigDecimal price;
    private String turnaroundTime;
    private String unit;
    private String referenceRange;
    @com.fasterxml.jackson.annotation.JsonProperty("isActive")
    private boolean active;
}
