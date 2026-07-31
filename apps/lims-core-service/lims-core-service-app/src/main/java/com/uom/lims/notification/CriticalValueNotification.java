package com.uom.lims.notification;

import com.uom.lims.api.enums.CriticalNotificationStatus;
import com.uom.lims.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * A critical-value (panic) callback for one critical result (H1). Tracks who is being
 * notified, the read-back acknowledgment, and the escalation state.
 */
@Entity
@Table(name = "critical_value_notification")
@Getter
@Setter
public class CriticalValueNotification extends BaseEntity {

    @Column(name = "result_id", nullable = false)
    private UUID resultId;

    @Column(name = "sample_id")
    private UUID sampleId;

    @Column(name = "parameter_id")
    private UUID parameterId;

    @Column(name = "parameter_name", length = 100)
    private String parameterName;

    @Column(name = "patient_code", length = 50)
    private String patientCode;

    @Column(name = "branch_code", length = 50)
    private String branchCode;

    @Column(name = "flag", length = 30)
    private String flag;

    @Column(name = "result_value", length = 100)
    private String resultValue;

    @Column(name = "priority", length = 16)
    private String priority;

    @Column(name = "recipient_name", length = 255)
    private String recipientName;

    @Column(name = "recipient_contact", length = 255)
    private String recipientContact;

    @Column(name = "channel", length = 16)
    private String channel;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private CriticalNotificationStatus status;

    @Column(name = "escalation_level", nullable = false)
    private Integer escalationLevel = 0;

    @Column(name = "raised_at", nullable = false)
    private Instant raisedAt;

    @Column(name = "notified_at")
    private Instant notifiedAt;

    @Column(name = "acknowledged_by", length = 255)
    private String acknowledgedBy;

    @Column(name = "acknowledged_at")
    private Instant acknowledgedAt;

    @Column(name = "read_back_text", length = 500)
    private String readBackText;

    @Column(name = "communicated_to", length = 255)
    private String communicatedTo;

    @Column(name = "read_back_verified")
    private Boolean readBackVerified;

    @Column(name = "next_escalation_due_at")
    private Instant nextEscalationDueAt;

    @Column(name = "closed_at")
    private Instant closedAt;
}
