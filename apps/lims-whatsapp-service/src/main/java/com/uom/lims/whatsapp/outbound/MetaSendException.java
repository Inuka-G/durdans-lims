package com.uom.lims.whatsapp.outbound;

/**
 * A send that the Graph API refused or that could not be attempted. Unchecked because
 * callers handle it the same way regardless of cause: the reply is abandoned and logged,
 * never retried blindly — the inbound message is already durable, so nothing is lost.
 */
public class MetaSendException extends RuntimeException {

    public MetaSendException(String message) {
        super(message);
    }

    public MetaSendException(String message, Throwable cause) {
        super(message, cause);
    }
}
