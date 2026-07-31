package com.uom.lims.api.enums;

/**
 * WHY: Tracks the full lifecycle of a sample across lab workflow.
 */
public enum SampleStatus {

    PENDING_COLLECTION,
    COLLECTED,
    IN_TRANSIT,
    RECEIVED_AT_LAB,
    QUALITY_CHECK,
    ACCEPTED,
    REJECTED,
    RECOLLECTION_REQUIRED,

    IN_TESTING,
    RESULT_ENTERED,
    SENT_FOR_VERIFICATION,
    VERIFIED,
    AUTHORIZED,
    DISPATCHED
}
