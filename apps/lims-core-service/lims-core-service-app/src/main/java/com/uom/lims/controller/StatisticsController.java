package com.uom.lims.controller;

import com.uom.lims.api.dashboard.StatisticsApi;
import com.uom.lims.api.dto.response.ApiResponse;
import com.uom.lims.api.dto.response.OrdersBillingStatsResponse;
import com.uom.lims.service.StatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

/**
 * WHY: Provides centralized metrics for orders and billing performance,
 * allowing reception management to track throughput and financial metrics.
 */
@RestController
@RequiredArgsConstructor
public class StatisticsController implements StatisticsApi {

    private final StatisticsService statisticsService;

    @Override
    @PreAuthorize("hasRole('BILLING_OFFICER')")
    public ResponseEntity<ApiResponse<OrdersBillingStatsResponse>> getOrdersBillingStats() {
        return ResponseEntity.ok(ApiResponse.success(statisticsService.getOrdersBillingStats()));
    }
}
