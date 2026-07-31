package com.uom.lims.api.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * WHY: Aggregates top-level operational metrics to drive dashboard overviews
 * and administrative decisions.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrdersBillingStatsResponse {
    private long testOrdersToday;
    private long pendingPayments;
    private long overduePayments;
    private long partialPayments;

    private BigDecimal totalRevenueToday;
    private String trend;
}
