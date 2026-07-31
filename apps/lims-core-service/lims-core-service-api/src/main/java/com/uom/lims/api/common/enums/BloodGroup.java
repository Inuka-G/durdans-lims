package com.uom.lims.api.common.enums;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Blood group of the patient")
public enum BloodGroup {
    A_POSITIVE,
    A_NEGATIVE,
    B_POSITIVE,
    B_NEGATIVE,
    AB_POSITIVE,
    AB_NEGATIVE,
    O_POSITIVE,
    O_NEGATIVE,
    UNKNOWN
}
