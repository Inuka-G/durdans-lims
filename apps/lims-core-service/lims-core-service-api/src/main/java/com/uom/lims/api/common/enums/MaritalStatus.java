package com.uom.lims.api.common.enums;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Marital status of the patient")
public enum MaritalStatus {
    SINGLE,
    MARRIED,
    DIVORCED,
    WIDOWED,
    OTHER
}
