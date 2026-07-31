package com.uom.lims.api.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * WHY: Provides a controlled mechanism to adjust billing amounts with mandatory rationale for audits.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BillDiscountRequest {
    @NotNull(message = "Discount amount is required")
    @DecimalMin(value = "0.00", message = "Discount cannot be negative")
    private BigDecimal discountAmount;

    @NotBlank(message = "Reason for discount is required")
    @Size(max = 500, message = "Reason too long")
    private String reason;
}
