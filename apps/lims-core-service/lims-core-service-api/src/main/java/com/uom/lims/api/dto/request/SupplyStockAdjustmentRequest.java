package com.uom.lims.api.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * WHY: Carries the movement rather than the resulting total, so the database applies the
 * arithmetic to whatever is on the shelf now. A count the browser read minutes ago cannot
 * be written back over collections that happened since.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupplyStockAdjustmentRequest {

    /**
     * WHY: Bounded at ten thousand because a delivery is counted in boxes of a hundred —
     * a larger figure is a mistyped quantity, and correcting it after the fact means
     * hunting down which tubes were never physically received.
     */
    @NotNull(message = "Stock adjustment is required")
    @Min(value = -10000, message = "Stock adjustment cannot exceed 10000 tubes")
    @Max(value = 10000, message = "Stock adjustment cannot exceed 10000 tubes")
    private Integer delta;

    /**
     * WHY: A zero adjustment moves nothing, so it is always a slip — an empty quantity box
     * or a double submit — and accepting it would log a restock that never happened.
     */
    @AssertTrue(message = "Stock adjustment cannot be zero")
    public boolean isNonZeroDelta() {
        return delta == null || delta != 0;
    }
}
