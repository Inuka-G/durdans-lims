package com.uom.lims.api.dto.response;

import com.uom.lims.api.enums.SampleStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * WHY: Exposes individual test properties to allow frontend line-item rendering for billing and reporting.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItemResponse {
    private String testId;
    private String testCode;
    private String testName;
    private String category;
    private BigDecimal price;
    private String sampleBarcode;
    private SampleStatus sampleStatus;
}
