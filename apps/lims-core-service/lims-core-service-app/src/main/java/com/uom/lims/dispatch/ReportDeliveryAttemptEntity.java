package com.uom.lims.dispatch;

import com.uom.lims.api.dispatch.enums.DeliveryAttemptStatus;
import com.uom.lims.api.dispatch.enums.DeliveryMethod;
import com.uom.lims.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "report_delivery_attempt")
public class ReportDeliveryAttemptEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "dispatch_item_id", nullable = false)
    private ReportDispatchItemEntity dispatchItem;

    @Enumerated(EnumType.STRING)
    @Column(name = "method", nullable = false, length = 20)
    private DeliveryMethod method;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private DeliveryAttemptStatus status;

    @Column(name = "failure_reason", length = 1000)
    private String failureReason;

    @Column(name = "retry_count", nullable = false)
    private int retryCount = 0;

    @Column(name = "dispatched_at")
    private LocalDateTime dispatchedAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Column(name = "recipient_contact", length = 1000)
    private String recipientContact;

    @Column(name = "tracking_number", length = 100)
    private String trackingNumber;

    @Column(name = "tracking_url", length = 2048)
    private String trackingUrl;
}
