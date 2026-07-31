package com.uom.lims.api.dashboard;

import com.uom.lims.api.dto.response.ApiResponse;
import com.uom.lims.api.dto.response.OrdersBillingStatsResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * WHY: Provides high-level operational reporting for management to monitor
 * branch performance, revenue trends, and ordering patterns in real-time.
 */
@RequestMapping("/api/v1/orders-billing")
@Tag(name = "Dashboard Statistics", description = "Aggregated operational metrics for the LIMS management dashboard")
public interface StatisticsApi {

    @Operation(summary = "Get orders and billing statistics", description = "Retrieves daily operational metrics and revenue trends")
    @ApiResponses(value = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Successfully retrieved dashboard statistics")
    })
    @GetMapping("/statistics")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<OrdersBillingStatsResponse>> getOrdersBillingStats();
}
