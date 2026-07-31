package com.uom.lims.notification;

/**
 * Raised inside the patient transaction; the email (carrying the raw token,
 * which is never persisted) is sent only after the transaction commits, so a
 * rollback can never leave a live verification link for an uncommitted patient.
 */
public record EmailVerificationRequestedEvent(String email, String fullName, String rawToken) {
}
