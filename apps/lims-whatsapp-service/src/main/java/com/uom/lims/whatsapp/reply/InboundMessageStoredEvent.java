package com.uom.lims.whatsapp.reply;

import java.util.UUID;

/**
 * Published after an inbound message is durably stored. This is the seam between the
 * two halves of the design: persistence happens synchronously before the webhook ack,
 * everything that reasons or replies hangs off this event, after commit, off the
 * request thread — where failure is recoverable because the message is already safe.
 */
public record InboundMessageStoredEvent(
        UUID messageId,
        UUID conversationId,
        String waId,
        String body,
        String messageType) {
}
