package com.uom.lims.exception;

/**
 * WHY: Orders and samples follow a strict clinical workflow with defined
 * allowed transitions (e.g. PENDING → IN_PROGRESS → COMPLETED).
 * Attempting an illegal transition (e.g. COMPLETED → PENDING) would corrupt
 * the audit trail and violate patient safety protocols. This exception signals
 * that the requested state change is not permitted from the entity's current
 * state, and maps to HTTP 422 so clients understand the entity exists but
 * the operation is contextually forbidden — distinct from a 403 authorization error.
 */
public class InvalidStateTransitionException extends RuntimeException {

    /**
     * @param message human-readable description of the illegal transition,
     *                e.g. "Cannot transition order from COMPLETED to PENDING"
     */
    public InvalidStateTransitionException(String message) {
        super(message);
    }
}
