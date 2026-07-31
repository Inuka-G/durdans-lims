package com.uom.lims.entity;

import com.uom.lims.api.enums.PaymentStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * WHY: Manages the financial lifecycle of an order separating invoice tracking from clinical tasks.
 */
@Entity
@Table(name = "bills")
@Getter
@Setter
public class BillEntity extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", unique = true, nullable = false)
    private OrderEntity order;

    @Column(name = "bill_no", unique = true, nullable = false)
    private String billNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false)
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    @Column(name = "subtotal", nullable = false)
    private BigDecimal subtotal;

    @Column(name = "service_charge", nullable = false)
    private BigDecimal serviceCharge;

    @Column(name = "discount")
    private BigDecimal discount = BigDecimal.ZERO;

    /** Mandatory rationale + approver + time for a discount (financial audit trail). */
    @Column(name = "discount_reason", length = 500)
    private String discountReason;

    @Column(name = "discount_by")
    private String discountBy;

    @Column(name = "discount_at")
    private Instant discountAt;

    @Column(name = "total_amount", nullable = false)
    private BigDecimal totalAmount;

    @Column(name = "paid_amount")
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(name = "print_count")
    private Integer printCount = 0;

    @Column(name = "last_printed_at")
    private Instant lastPrintedAt;

    @Column(name = "last_printed_by")
    private String lastPrintedBy;

    @OneToMany(mappedBy = "bill", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<PaymentEntity> payments = new ArrayList<>();
}
