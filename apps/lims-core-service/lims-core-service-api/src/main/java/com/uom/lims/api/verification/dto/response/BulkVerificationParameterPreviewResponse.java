package com.uom.lims.api.verification.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkVerificationParameterPreviewResponse {
    private String parameterName;
    private String resultValue;
    private String unit;
    private String flag;
}
