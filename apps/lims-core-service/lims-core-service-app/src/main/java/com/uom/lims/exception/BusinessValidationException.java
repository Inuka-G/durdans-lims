package com.uom.lims.exception;

/**
 * WHY: Thrown when a service method receives syntactically valid input that
 * violates a domain business rule — for example, applying a discount that
 * exceeds 100%, or processing payment on an already-cancelled order.
 * Mapping this to HTTP 422 (Unprocessable Entity) tells API consumers that
 * the request was well-formed but semantically rejected by business logic,
 * which is more informative than a generic 400 Bad Request.
 */
public class BusinessValidationException extends RuntimeException {

    /**
     * @param message human-readable description of the violated business rule,
     *                e.g. "Discount 110% exceeds maximum allowed 100%"
     */
    public BusinessValidationException(String message) {
        super(message);
    }
}
