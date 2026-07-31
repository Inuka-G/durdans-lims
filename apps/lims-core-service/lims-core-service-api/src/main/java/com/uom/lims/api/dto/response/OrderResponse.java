package com.uom.lims.api.dto.response;

import com.uom.lims.api.enums.OrderStatus;
import com.uom.lims.api.enums.Priority;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.UUID;

/**
 * WHY: Delivers the core clinical tracking details of a patient episode without
 * exposing internal financial logic.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponse {
    private UUID id;
    private String orderId;
    private String patientId;
    private String patientName;
    private Integer patientAge;
    private String patientGender;
    private String orderDate;
    private OrderStatus status;
    private Priority priority;
    private String referringDoctor;
    private String referringDepartment;
    private String remarks;
    private String createdBy;
    private com.uom.lims.api.enums.PaymentStatus paymentStatus;
    private List<OrderItemResponse> tests;
}
