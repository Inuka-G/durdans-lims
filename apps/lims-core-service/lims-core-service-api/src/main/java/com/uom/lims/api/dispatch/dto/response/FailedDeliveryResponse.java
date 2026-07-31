package com.uom.lims.api.dispatch.dto.response;

import com.uom.lims.api.dispatch.enums.DeliveryMethod;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FailedDeliveryResponse {

    private UUID attemptId;
    private String reportId;
    private String patientName;
    private String testName;
    private DeliveryMethod method;
    private String failureReason;
    private String failedDateTime;
    private int retryCount;
}
