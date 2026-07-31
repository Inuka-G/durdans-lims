package com.uom.lims.api.dto.response;

import com.uom.lims.api.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderTrackingResponse {
    private UUID orderId;
    private String orderNo;
    private OrderStatus orderStatus;
    private String currentStage;
    private String currentDescription;
    private List<OrderTrackingStepResponse> steps;
    private List<OrderTrackingEventResponse> events;
}
