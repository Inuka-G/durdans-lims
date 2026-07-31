package com.uom.lims.api.critical.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

/** A critical-value callback as exposed to the clinician/lab UI (H1). */
@Getter
@Builder
public class CriticalNotificationResponse {

    private String id;
    private String resultId;
    private String patientCode;
    private String parameterName;
    private String flag;
    private String resultValue;
    private String priority;
    private String status;
    private Integer escalationLevel;

    private String recipientName;
    private String recipientContact;
    private String channel;

    private Instant raisedAt;
    private Instant notifiedAt;
    private Instant nextEscalationDueAt;

    private String acknowledgedBy;
    private Instant acknowledgedAt;
    private String readBackText;
    private String communicatedTo;
    private Boolean readBackVerified;
}
