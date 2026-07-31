package com.uom.lims.api.dto.request;

import com.uom.lims.api.enums.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * WHY: Captures financial transaction inputs separately from clinical workflows for auditing compliance.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequest {
    @NotNull(message = "Bill ID is required")
    private UUID billId;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Payment amount must be greater than zero")
    private BigDecimal amount;

    @NotNull(message = "Payment method is required")
    private PaymentMethod paymentMethod;

    @Size(max = 100, message = "Bank reference no too long")
    private String bankReferenceNo;

    @Size(max = 100, message = "Bank name too long")
    private String bankName;

    @Size(max = 100, message = "Insurance claim no too long")
    private String insuranceClaimNo;

    @Size(max = 500, message = "Payment notes too long")
    private String notes;
}
