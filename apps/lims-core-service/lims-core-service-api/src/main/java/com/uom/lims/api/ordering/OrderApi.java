package com.uom.lims.api.ordering;

import com.uom.lims.api.dto.request.OrderCreateRequest;
import com.uom.lims.api.dto.response.ApiResponse;
import com.uom.lims.api.dto.response.OrderResponse;
import com.uom.lims.api.dto.response.OrderTrackingResponse;
import com.uom.lims.api.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * WHY: Defines the contract for clinical order management, including atomic creation
 * of tests, billing, and sample requirements to maintain data integrity.
 */
@RequestMapping("/api/v1/orders")
@Tag(name = "Order Management", description = "Operations related to patient clinical orders")
public interface OrderApi {

    @Operation(summary = "Create a new order", description = "Initializes a patient order, calculates billing, and prepares samples for collection")
    @ApiResponses(value = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201", description = "Order created successfully"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Invalid input data"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Patient already has an active order")
    })
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ResponseEntity<ApiResponse<OrderResponse>> createOrder(@Valid @RequestBody OrderCreateRequest request);

    @Operation(summary = "List all orders", description = "Retrieves a paginated list of all non-deleted orders")
    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<PageResponse<OrderResponse>>> getOrders(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "patientId", required = false) String patientId,
            @RequestParam(name = "sort", defaultValue = "createdAt,desc") String sort);

    @Operation(summary = "Get order by ID", description = "Retrieves full details of a specific order including test line items")
    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<OrderResponse>> getOrderById(@PathVariable("id") UUID id);

    @Operation(summary = "Get order tracking timeline", description = "Retrieves the clinical workflow and report delivery tracking events for an order")
    @GetMapping("/{id}/tracking")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<OrderTrackingResponse>> getOrderTracking(@PathVariable("id") UUID id);

    @Operation(summary = "Cancel an order", description = "Transitions a PENDING order to CANCELLED status")
    @ApiResponses(value = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Order cancelled successfully"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "422", description = "Order cannot be cancelled in its current state")
    })
    @PatchMapping("/{id}/cancel")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<OrderResponse>> cancelOrder(@PathVariable("id") UUID id);
}
