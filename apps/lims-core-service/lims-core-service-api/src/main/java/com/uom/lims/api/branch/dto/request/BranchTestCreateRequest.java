package com.uom.lims.api.branch.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class BranchTestCreateRequest {

    @NotBlank(message = "Test name is required")
    private String testName;

    @NotBlank(message = "Test code is required")
    private String testCode;

    @NotBlank(message = "Category is required")
    private String category;

    @NotNull(message = "Price is required")
    private BigDecimal price;

    @NotBlank(message = "Turnaround time is required")
    private String turnaroundTime;

    private String unit;

    private String referenceRange;

    @com.fasterxml.jackson.annotation.JsonProperty("isActive")
    private boolean active = true;
}
