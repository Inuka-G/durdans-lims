package com.uom.lims.whatsapp.reply;

import java.util.UUID;

/**
 * Published after an inbound message is durably stored. This is the seam between the
 * two halves of the design: persistence happens synchronously before the webhook ack,
 * everything that reasons or replies hangs off this event, after commit, off the
 * request thread — where failure is recoverable because the message is already safe.
 *
 * <p>{@code interactiveId} is the machine id of a tapped list row or button
 * ({@code menu_prices}, {@code test_FBC}), null for typed text. The body carries the
 * human title either way — the id exists so deterministic routing never has to parse
 * display text, which is the part that gets translated and reworded.
 */
public record InboundMessageStoredEvent(
        UUID messageId,
        UUID conversationId,
        String waId,
        String body,
        String messageType,
        String interactiveId) {
}
