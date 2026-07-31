package com.uom.lims.api.dispatch.dto.response;

import com.uom.lims.api.dispatch.enums.DeliveryMethod;
import com.uom.lims.api.dispatch.enums.DispatchItemStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Summary row for the dispatch dashboard (aligned with frontend DispatchReport)")
public class DispatchDashboardItemResponse {

    private UUID id;
    @Schema(description = "Same as reportReference; dashboard label")
    private String reportId;
    private String patientName;
    private String patientId;
    private String testName;
    private String authorizedDate;
    private String authorizedTime;
    private List<DeliveryMethod> deliveryMethods;
    private DispatchItemStatus status;
}
