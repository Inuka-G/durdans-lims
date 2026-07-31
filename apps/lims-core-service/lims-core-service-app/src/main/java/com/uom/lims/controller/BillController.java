package com.uom.lims.controller;

import com.uom.lims.api.billing.BillApi;
import com.uom.lims.api.dto.request.BillDiscountRequest;
import com.uom.lims.api.dto.request.PaymentRequest;
import com.uom.lims.api.dto.response.ApiResponse;
import com.uom.lims.api.dto.response.BillResponse;

import com.uom.lims.service.BillingService;
import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * WHY: Exposes billing and payment operations to reception staff, ensuring
 * that patient payments are handled atomically with order status updates.
 */
@RestController
@RequiredArgsConstructor
public class BillController implements BillApi {

    private final BillingService billingService;

    @Override
    @PreAuthorize("hasRole('BILLING_OFFICER')")
    public ResponseEntity<ApiResponse<BillResponse>> getBillByOrderId(UUID orderId) {
        return ResponseEntity.ok(ApiResponse.success(billingService.getBillByOrderId(orderId)));
    }

    @Override
    @PreAuthorize("hasRole('BILLING_OFFICER')")
    public ResponseEntity<ApiResponse<BillResponse>> getBillById(UUID billId) {
        return ResponseEntity.ok(ApiResponse.success(billingService.getBillById(billId)));
    }

    @Override
    @PreAuthorize("hasRole('BILLING_OFFICER')")
    public ResponseEntity<ApiResponse<BillResponse>> applyDiscount(UUID billId, BillDiscountRequest request) {
        return ResponseEntity.ok(ApiResponse.success(billingService.applyDiscount(billId, request)));
    }

    @Override
    @PreAuthorize("hasRole('BILLING_OFFICER')")
    public ResponseEntity<ApiResponse<BillResponse>> processPayment(UUID billId, PaymentRequest request) {
        BillResponse response = billingService.processPayment(billId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Payment recorded successfully"));
    }

    @Override
    @PreAuthorize("hasRole('BILLING_OFFICER')")
    public ResponseEntity<ApiResponse<BillResponse>> recordBillPrint(UUID billId) {
        return ResponseEntity.ok(ApiResponse.success(billingService.recordBillPrint(billId)));
    }

}
