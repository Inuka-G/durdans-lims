package com.uom.lims.api.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * WHY: Provides catalog entries for dynamic UI rendering of order forms without hardcoding catalogs.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LabTestResponse {
    private String id;
    private String testCode;
    private String testName;
    private String category;
    private BigDecimal price;
    private String sampleType;
    private String tubeType;
    private Integer turnAroundTimeHours;
}
