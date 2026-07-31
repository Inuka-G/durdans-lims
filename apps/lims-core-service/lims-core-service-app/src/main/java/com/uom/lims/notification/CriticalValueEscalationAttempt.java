package com.uom.lims.notification;

import com.uom.lims.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * One send attempt of a critical-value callback at a given escalation level (H1) —
 * the medico-legal record of each call-out.
 */
@Entity
@Table(name = "critical_value_escalation_attempt")
@Getter
@Setter
public class CriticalValueEscalationAttempt extends BaseEntity {

    @Column(name = "notification_id", nullable = false)
    private UUID notificationId;

    @Column(name = "level", nullable = false)
    private Integer level;

    @Column(name = "channel", length = 16)
    private String channel;

    @Column(name = "recipient_contact", length = 255)
    private String recipientContact;

    @Column(name = "status", length = 16)
    private String status;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;
}
