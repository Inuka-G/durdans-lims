package com.uom.lims.api.dto.response;

import com.uom.lims.api.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * WHY: Consolidates financial state and historical transactions for patient invoicing and payment portals.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BillResponse {
    private UUID id;
    private String billId;
    private String orderId;
    private String patientId;
    private String patientName;
    private String patientPhone;
    private Instant orderDate;
    private Instant billDate;
    private BigDecimal subtotal;
    private BigDecimal serviceCharge;
    private BigDecimal discount;
    private BigDecimal totalAmount;
    private BigDecimal paidAmount;
    private BigDecimal outstandingAmount;
    private PaymentStatus paymentStatus;
    private List<OrderItemResponse> tests;
    private List<PaymentResponse> payments;
}
