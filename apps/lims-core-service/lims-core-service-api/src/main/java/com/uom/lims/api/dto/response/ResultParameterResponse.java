package com.uom.lims.api.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

public record ResultParameterResponse(
        UUID parameterId,
        String parameterName,
        String result,
        String unit,
        BigDecimal refLow,
        BigDecimal refHigh,
        String flag,
        PreviousValueResponse previousValue) {
}