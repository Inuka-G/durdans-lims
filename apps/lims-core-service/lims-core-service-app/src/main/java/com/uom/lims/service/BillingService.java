package com.uom.lims.service;

import com.uom.lims.api.dto.request.BillDiscountRequest;
import com.uom.lims.api.dto.request.PaymentRequest;
import com.uom.lims.api.dto.response.BillResponse;
import com.uom.lims.api.dto.response.OrderItemResponse;
import com.uom.lims.api.dto.response.PaymentResponse;
import com.uom.lims.api.enums.OrderStatus;
import com.uom.lims.api.enums.PaymentMethod;
import com.uom.lims.api.enums.PaymentStatus;
import com.uom.lims.api.patient.dto.response.PatientResponse;
import com.uom.lims.config.BillingProperties;
import com.uom.lims.entity.BillEntity;
import com.uom.lims.entity.PaymentEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.exception.BusinessValidationException;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.repository.BillRepository;
import com.uom.lims.repository.OrderRepository;
import com.uom.lims.repository.PaymentRepository;
import com.uom.lims.repository.TestCatalogRepository;
import com.uom.lims.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * WHY: Manages the complete financial lifecycle of a patient invoice including
 * discount application and payment processing. Separating billing from clinical
 * order logic means finance rules can evolve independently of sample collection
 * workflows — a key separation of concerns required by hospital accounting
 * regulations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class BillingService {

        private final BillRepository billRepository;
        private final PaymentRepository paymentRepository;
        private final OrderRepository orderRepository;
        private final TestCatalogRepository testCatalogRepository;
        private final PatientClientService patientClientService;
        private final BillingProperties billingProperties;

        /**
         * WHY: Fetching a bill by order ID is the primary path from the order detail
         * page —
         * the frontend navigates order → bill rather than storing bill IDs directly.
         */
        @Transactional(readOnly = true)
        public BillResponse getBillByOrderId(UUID orderId) {
                BillEntity bill = billRepository.findByOrderIdAndDeletedFalse(orderId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Bill not found for order id: " + orderId));
                assertBranchAccess(bill);
                return toResponse(bill);
        }

        /**
         * Tenant isolation: a non-super-admin may only act on a bill whose owning
         * order is in their branch. Cross-branch access is reported as not-found.
         */
        private void assertBranchAccess(BillEntity bill) {
                String branch = bill.getOrder() != null ? bill.getOrder().getBranchCode() : null;
                if (!SecurityUtils.canAccessBranch(branch)) {
                        throw new ResourceNotFoundException("Bill not found");
                }
        }

        /**
         * WHY: Direct bill lookup by ID is used by the payment and print workflows
         * which receive the bill UUID from prior API responses.
         */
        @Transactional(readOnly = true)
        public BillResponse getBillById(UUID billId) {
                BillEntity bill = billRepository.findById(billId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Bill not found with id: " + billId));
                assertBranchAccess(bill);
                return toResponse(bill);
        }

        /**
         * WHY: Discounts are applied before payment. Validating that discount never
         * exceeds totalAmount prevents negative balances that corrupt accounting.
         * Blocking discounts on PAID bills prevents retroactive adjustments
         * that would invalidate issued receipts.
         */
        public BillResponse applyDiscount(UUID billId, BillDiscountRequest request) {
                BillEntity bill = billRepository.findById(billId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Bill not found with id: " + billId));
                assertBranchAccess(bill);

                if (bill.getPaymentStatus() == PaymentStatus.PAID) {
                        throw new BusinessValidationException(
                                        "Cannot apply discount to bill " + bill.getBillNo()
                                                        + " — bill is already fully paid");
                }

                if (request.getDiscountAmount().compareTo(bill.getTotalAmount()) > 0) {
                        throw new BusinessValidationException(
                                        "Discount " + request.getDiscountAmount()
                                                        + " exceeds total amount " + bill.getTotalAmount()
                                                        + " for bill " + bill.getBillNo());
                }

                bill.setDiscount(request.getDiscountAmount());
                // Persist the mandatory rationale + approver + time (financial audit).
                bill.setDiscountReason(request.getReason());
                bill.setDiscountBy(SecurityUtils.getCurrentUsername());
                bill.setDiscountAt(Instant.now());
                // WHY: Recalculate from source values to prevent compounding errors
                // if applyDiscount is called multiple times
                bill.setTotalAmount(
                                bill.getSubtotal()
                                                .add(bill.getServiceCharge())
                                                .subtract(request.getDiscountAmount()));

                BillEntity saved = billRepository.save(bill);
                log.info("Discount {} applied to bill {} by {}",
                                request.getDiscountAmount(),
                                bill.getBillNo(),
                                SecurityUtils.getCurrentUsername());
                return toResponse(saved);
        }

        /**
         * WHY: Full payment only — partial payments are not permitted because
         * sample collection requires complete financial commitment from patient.
         * Validation happens BEFORE saving payment to prevent orphaned payment
         * records if validation fails.
         */
        public BillResponse processPayment(UUID billId, PaymentRequest request) {
                BillEntity bill = billRepository.findById(billId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Bill not found with id: " + billId));
                assertBranchAccess(bill);

                // Validate bill is not already paid
                if (bill.getPaymentStatus() == PaymentStatus.PAID) {
                        throw new BusinessValidationException(
                                        "Bill " + bill.getBillNo()
                                                        + " is already fully paid — no further payments accepted");
                }

                // WHY: Validate BEFORE saving payment — prevents orphaned payment records
                BigDecimal newPaidAmount = bill.getPaidAmount().add(request.getAmount());
                if (newPaidAmount.compareTo(bill.getTotalAmount()) < 0) {
                        throw new BusinessValidationException(
                                        "Partial payments are not permitted. Full amount required: "
                                                        + bill.getTotalAmount()
                                                        + ". You attempted to pay: " + request.getAmount());
                }

                if (newPaidAmount.compareTo(bill.getTotalAmount()) > 0) {
                        throw new BusinessValidationException(
                                        "Payment amount " + request.getAmount()
                                                        + " exceeds total amount " + bill.getTotalAmount()
                                                        + " for bill " + bill.getBillNo());
                }

                // WHY: Bank transfers require reference for banking reconciliation
                if (request.getPaymentMethod() == PaymentMethod.BANK_TRANSFER) {
                        if (request.getBankReferenceNo() == null
                                        || request.getBankReferenceNo().isBlank()) {
                                throw new BusinessValidationException(
                                                "Bank reference number is required for BANK_TRANSFER payments");
                        }
                }

                // WHY: Insurance requires claim number for insurer reimbursement tracking
                if (request.getPaymentMethod() == PaymentMethod.INSURANCE) {
                        if (request.getInsuranceClaimNo() == null
                                        || request.getInsuranceClaimNo().isBlank()) {
                                throw new BusinessValidationException(
                                                "Insurance claim number is required for INSURANCE payments");
                        }
                }

                // Save payment record
                PaymentEntity payment = new PaymentEntity();
                payment.setBill(bill);
                payment.setAmount(request.getAmount());
                payment.setPaymentMethod(request.getPaymentMethod());
                payment.setBankReferenceNo(request.getBankReferenceNo());
                payment.setBankName(request.getBankName());
                payment.setInsuranceClaimNo(request.getInsuranceClaimNo());
                payment.setNotes(request.getNotes());
                payment.setPaymentDate(Instant.now());
                payment.setReversed(false);
                payment.setCreatedBy(SecurityUtils.getCurrentUsername());
                paymentRepository.save(payment);

                // Update bill to PAID
                bill.setPaidAmount(newPaidAmount);
                bill.setPaymentStatus(PaymentStatus.PAID);
                if (bill.getOrder() != null && bill.getOrder().getStatus() == OrderStatus.PENDING) {
                        bill.getOrder().setStatus(OrderStatus.IN_PROGRESS);
                }

                BillEntity saved = billRepository.save(bill);
                log.info("Full payment {} processed for bill {} by {}",
                                request.getAmount(),
                                bill.getBillNo(),
                                SecurityUtils.getCurrentUsername());
                return toResponse(saved);
        }

        /**
         * WHY: Recording print events supports audit requirements — hospital policy
         * requires tracking when and by whom each invoice was issued.
         * Print count supports re-print detection for fraud prevention.
         */
        public BillResponse recordBillPrint(UUID billId) {
                BillEntity bill = billRepository.findById(billId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Bill not found with id: " + billId));
                assertBranchAccess(bill);

                bill.setPrintCount(bill.getPrintCount() + 1);
                bill.setLastPrintedAt(Instant.now());
                bill.setLastPrintedBy(SecurityUtils.getCurrentUsername());

                BillEntity saved = billRepository.save(bill);
                log.info("Bill {} printed (count: {}) by {}",
                                bill.getBillNo(),
                                saved.getPrintCount(),
                                saved.getLastPrintedBy());
                return toResponse(saved);
        }

        /**
         * WHY: Centralised mapping ensures every method returns identical BillResponse.
         * outstandingAmount computed here — never stored — to avoid DB inconsistency.
         */
        private BillResponse toResponse(BillEntity bill) {
                // WHY: Patient details fetched from patient module — not duplicated here
                String patientId = bill.getOrder() != null
                                ? bill.getOrder().getPatientId()
                                : null;
                PatientResponse patient = patientId != null
                                ? patientClientService.getPatientByCode(
                                                patientId, SecurityUtils.getCurrentBearerToken())
                                : null;

                List<OrderItemResponse> itemResponses = bill.getOrder() != null
                                && bill.getOrder().getItems() != null
                                                ? bill.getOrder().getItems().stream()
                                                                .map(item -> {
                                                                        TestCatalogEntity test = testCatalogRepository
                                                                                        .findById(item.getTestId())
                                                                                        .orElse(null);
                                                                        return OrderItemResponse.builder()
                                                                                        .testId(item.getTestId()
                                                                                                        .toString())
                                                                                        .testCode(test != null ? test
                                                                                                        .getTestCode()
                                                                                                        : null)
                                                                                        .testName(test != null ? test
                                                                                                        .getTestName()
                                                                                                        : null)
                                                                                        .category(test != null ? test
                                                                                                        .getCategory()
                                                                                                        : null)
                                                                                        .price(item.getPrice())
                                                                                        .build();
                                                                })
                                                                .toList()
                                                : List.of();

                List<PaymentResponse> paymentResponses = bill.getPayments() != null
                                ? bill.getPayments().stream()
                                                .map(p -> PaymentResponse.builder()
                                                                .id(p.getId())
                                                                .amount(p.getAmount())
                                                                .paymentMethod(p.getPaymentMethod())
                                                                .paymentDate(p.getPaymentDate())
                                                                .reversed(p.isReversed())
                                                                .notes(p.getNotes())
                                                                .build())
                                                .toList()
                                : List.of();

                // WHY: Outstanding computed not stored — prevents inconsistency with paidAmount
                BigDecimal outstanding = bill.getTotalAmount().subtract(bill.getPaidAmount());

                return BillResponse.builder()
                                .id(bill.getId())
                                .billId(bill.getBillNo())
                                .orderId(bill.getOrder() != null
                                                ? bill.getOrder().getOrderNo()
                                                : null)
                                .patientId(bill.getOrder() != null
                                                ? bill.getOrder().getPatientId()
                                                : null)
                                .patientName(patient != null ? patient.getFullName() : null)
                                .patientPhone(patient != null ? patient.getPhone() : null)
                                .orderDate(bill.getOrder() != null
                                                ? bill.getOrder().getCreatedAt()
                                                : null)
                                .billDate(bill.getCreatedAt())
                                .subtotal(bill.getSubtotal())
                                .serviceCharge(bill.getServiceCharge())
                                .discount(bill.getDiscount())
                                .totalAmount(bill.getTotalAmount())
                                .paidAmount(bill.getPaidAmount())
                                .outstandingAmount(outstanding)
                                .paymentStatus(bill.getPaymentStatus())
                                .tests(itemResponses)
                                .payments(paymentResponses)
                                .build();
        }
}
