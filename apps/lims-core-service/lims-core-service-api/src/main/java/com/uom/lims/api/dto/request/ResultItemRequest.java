package com.uom.lims.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record ResultItemRequest(

        @NotNull(message = "Parameter id is required") UUID parameterId,

        @NotBlank(message = "Result value is required") @Size(max = 100, message = "Result value must be less than 100 characters") String result,

        @Size(max = 50, message = "Unit must be less than 50 characters") String unit,

        @Size(max = 30, message = "Flag must be less than 30 characters") String flag) {
}