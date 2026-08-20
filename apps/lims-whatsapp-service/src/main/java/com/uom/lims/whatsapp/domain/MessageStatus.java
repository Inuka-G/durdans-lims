package com.uom.lims.whatsapp.domain;

/**
 * Lifecycle of a message. Inbound messages land as {@link #RECEIVED}; outbound ones
 * walk QUEUED to SENT to DELIVERED as Meta reports status back on the webhook.
 */
public enum MessageStatus {
    RECEIVED,
    QUEUED,
    SENT,
    DELIVERED,
    READ,
    FAILED
}
