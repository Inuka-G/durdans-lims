package com.uom.lims.api.clinical.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReturnToMLTRequest {
    private String resultId;

    private String status;

    @NotBlank
    private String returnReason;
}
