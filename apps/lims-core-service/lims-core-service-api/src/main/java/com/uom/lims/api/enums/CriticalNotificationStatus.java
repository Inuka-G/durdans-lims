package com.uom.lims.api.enums;

/**
 * Lifecycle of a critical-value (panic) callback (H1).
 *
 * <pre>
 *   PENDING      → raised, callback not yet sent
 *   NOTIFIED     → callback sent to the recipient, awaiting read-back/acknowledgment
 *   ESCALATED    → SLA elapsed without acknowledgment; escalated to the next tier
 *   ACKNOWLEDGED → clinician acknowledged with read-back (terminal, success)
 *   CLOSED       → escalation exhausted without acknowledgment (terminal, dead-letter)
 * </pre>
 */
public enum CriticalNotificationStatus {
    PENDING,
    NOTIFIED,
    ESCALATED,
    ACKNOWLEDGED,
    CLOSED
}
