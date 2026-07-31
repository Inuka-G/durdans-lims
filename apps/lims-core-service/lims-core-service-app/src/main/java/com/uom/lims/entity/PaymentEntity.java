package com.uom.lims.entity;

import com.uom.lims.api.enums.PaymentMethod;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * WHY: Records granular payment events allowing complex partial payment structures and complete financial audit trails.
 */
@Entity
@Table(name = "payments")
@Getter
@Setter
public class PaymentEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bill_id", nullable = false)
    private BillEntity bill;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false)
    private PaymentMethod paymentMethod;

    @Column(name = "bank_reference_no")
    private String bankReferenceNo;

    @Column(name = "bank_name")
    private String bankName;

    @Column(name = "insurance_claim_no")
    private String insuranceClaimNo;

    @Column(name = "notes", length = 500)
    private String notes;

    @Column(name = "payment_date", nullable = false)
    private Instant paymentDate;

    @Column(name = "is_reversed", nullable = false)
    private boolean reversed = false;

    @Column(name = "reversed_at")
    private Instant reversedAt;

    @Column(name = "reversed_by")
    private String reversedBy;

    @Column(name = "reversal_reason")
    private String reversalReason;

}
