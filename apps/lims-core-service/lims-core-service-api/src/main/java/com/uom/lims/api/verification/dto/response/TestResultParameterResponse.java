package com.uom.lims.api.verification.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestResultParameterResponse {
    private String parameterCode;
    private String parameterName;
    private BigDecimal resultValue;
    private String resultText;
    private String unit;
    private BigDecimal referenceRangeLow;
    private BigDecimal referenceRangeHigh;
    private String flag;
}