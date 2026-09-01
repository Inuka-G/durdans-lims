package com.uom.lims.api.verification.enums;

public enum ResultStatus {
    ENTERED,
    TECHNICALLY_VERIFIED,
    REJECTED,
    CLINICALLY_AUTHORIZED,
    RETURNED,
    /** Pathologist sent the case back to the lab supervisor for recheck. */
    RETURNED_FOR_RECHECK,
    /**
     * Lab supervisor sent the case back to the MLT for re-run / re-entry. Kept
     * distinct from {@link #RETURNED_FOR_RECHECK} so the two return directions can
     * be told apart on every screen and in every audit row.
     */
    RETURNED_TO_MLT,
    DISPATCHED;
}
