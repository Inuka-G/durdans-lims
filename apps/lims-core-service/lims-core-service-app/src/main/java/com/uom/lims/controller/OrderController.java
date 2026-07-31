package com.uom.lims.controller;

import com.uom.lims.api.ordering.OrderApi;
import com.uom.lims.api.dto.request.OrderCreateRequest;
import com.uom.lims.api.dto.response.ApiResponse;
import com.uom.lims.api.dto.response.OrderResponse;
import com.uom.lims.api.dto.response.OrderTrackingResponse;
import com.uom.lims.api.common.PageResponse;
import com.uom.lims.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * WHY: Orchestrates the order lifecycle from reception to clinical processing,
 * ensuring all medicolegal audit requirements and business rules are enforced.
 */
@RestController
@RequiredArgsConstructor
public class OrderController implements OrderApi {

    private final OrderService orderService;

    @Override
    @PreAuthorize("hasRole('BILLING_OFFICER')")
    public ResponseEntity<ApiResponse<OrderResponse>> createOrder(OrderCreateRequest request) {
        OrderResponse response = orderService.createOrder(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Order created successfully"));
    }

    @Override
    @PreAuthorize("hasAnyRole('BILLING_OFFICER','FRONT_DESK','BRANCH_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<PageResponse<OrderResponse>>> getOrders(int page, int size, String patientId, String sort) {
        Sort springSort;
        try {
            String[] sortParts = sort.split(",");
            springSort = Sort.by(sortParts.length > 1 && sortParts[1].equalsIgnoreCase("desc")
                    ? Sort.Direction.DESC
                    : Sort.Direction.ASC, sortParts[0]);
        } catch (Exception e) {
            springSort = Sort.by(Sort.Direction.DESC, "createdAt");
        }

        Page<OrderResponse> result = orderService.getOrders(PageRequest.of(page, size, springSort), patientId);

        PageResponse<OrderResponse> pageResponse = new PageResponse<>(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.isLast());
        return ResponseEntity.ok(ApiResponse.success(pageResponse));
    }

    @Override
    @PreAuthorize("hasAnyRole('BILLING_OFFICER','PHLEBOTOMIST','FRONT_DESK','BRANCH_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<OrderResponse>> getOrderById(UUID id) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getOrderById(id)));
    }

    @Override
    @PreAuthorize("hasAnyRole('BILLING_OFFICER','PHLEBOTOMIST','FRONT_DESK','BRANCH_ADMIN','SUPER_ADMIN','MLT','LAB_SUPERVISOR','PATHOLOGIST','DISPATCH','DISPATCH_OFFICER','REPORT_DISPATCH')")
    public ResponseEntity<ApiResponse<OrderTrackingResponse>> getOrderTracking(UUID id) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getOrderTracking(id)));
    }

    @Override
    @PreAuthorize("hasRole('BILLING_OFFICER')")
    public ResponseEntity<ApiResponse<OrderResponse>> cancelOrder(UUID id) {
        return ResponseEntity.ok(ApiResponse.success(orderService.cancelOrder(id)));
    }
}
