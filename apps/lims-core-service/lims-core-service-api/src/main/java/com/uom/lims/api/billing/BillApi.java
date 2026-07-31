package com.uom.lims.api.billing;

import com.uom.lims.api.dto.request.BillDiscountRequest;
import com.uom.lims.api.dto.request.PaymentRequest;
import com.uom.lims.api.dto.response.ApiResponse;
import com.uom.lims.api.dto.response.BillResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * WHY: Manages the financial lifecycle of an order, ensuring all payments are tracked
 * and discounts are applied correctly for medicolegal and clinical audit trails.
 */
@RequestMapping("/api/v1/billing")
@Tag(name = "Billing and Payments", description = "Operations related to patient invoices and financial transactions")
public interface BillApi {

    @Operation(summary = "Get bill by order ID", description = "Retrieves the invoice associated with a specific clinical order")
    @GetMapping("/orders/{orderId}/bill")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<BillResponse>> getBillByOrderId(@PathVariable("orderId") UUID orderId);

    @Operation(summary = "Get bill by ID", description = "Retrieves details of a specific invoice")
    @GetMapping("/bills/{billId}")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<BillResponse>> getBillById(@PathVariable("billId") UUID billId);

    @Operation(summary = "Apply discount to bill", description = "Adjusts the total amount of a bill before final payment")
    @PatchMapping("/bills/{billId}/discount")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<BillResponse>> applyDiscount(@PathVariable("billId") UUID billId, @Valid @RequestBody BillDiscountRequest request);

    @Operation(summary = "Process bill payment", description = "Records a payment transaction and updates the bill's payment status")
    @PostMapping("/bills/{billId}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    ResponseEntity<ApiResponse<BillResponse>> processPayment(@PathVariable("billId") UUID billId, @Valid @RequestBody PaymentRequest request);

    @Operation(summary = "Record bill print", description = "Logs the printing of a physical invoice for audit purposes")
    @PostMapping("/bills/{billId}/print")
    @ResponseStatus(HttpStatus.OK)
    ResponseEntity<ApiResponse<BillResponse>> recordBillPrint(@PathVariable("billId") UUID billId);

}


