package com.uom.lims.api.branch.dto.request;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class BranchTestUpdateRequest {

    private String testName;
    private String testCode;
    private String category;
    private BigDecimal price;
    private String turnaroundTime;
    private String unit;
    private String referenceRange;
    @com.fasterxml.jackson.annotation.JsonProperty("isActive")
    private Boolean active;
}
