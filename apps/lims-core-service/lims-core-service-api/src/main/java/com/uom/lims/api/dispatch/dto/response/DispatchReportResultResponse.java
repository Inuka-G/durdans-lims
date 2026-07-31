package com.uom.lims.api.dispatch.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DispatchReportResultResponse {
    private String parameter;
    private String result;
    private String unit;
    private String flag;
    private String referenceRange;
    private boolean abnormal;
}
