package com.uom.lims.api.common.enums;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Honorific title or prefix of the patient")
public enum Title {
    MR,
    MRS,
    MS,
    MISS,
    DR,
    PROF,
    REV
}
