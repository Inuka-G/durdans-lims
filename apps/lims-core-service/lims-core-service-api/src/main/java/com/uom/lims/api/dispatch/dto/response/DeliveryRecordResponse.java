package com.uom.lims.api.dispatch.dto.response;

import com.uom.lims.api.dispatch.enums.DeliveryMethod;
import com.uom.lims.api.dispatch.enums.DispatchItemStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Aggregated delivery view for tracking (Delivery Status page)")
public class DeliveryRecordResponse {

    private String reportId;
    private String patientName;
    private String testName;
    private List<DeliveryMethod> methods;
    @Schema(description = "PENDING, DELIVERED, FAILED, or PARTIAL derived from attempts")
    private DispatchItemStatus status;
    private String dispatchedTime;
    private String deliveredTime;
    private String trackingNumber;
    private String trackingUrl;
}
