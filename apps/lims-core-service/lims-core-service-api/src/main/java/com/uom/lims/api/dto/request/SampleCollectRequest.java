package com.uom.lims.api.dto.request;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * WHY: Submits phlebotomy execution details capturing any observed abnormalities during collection.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SampleCollectRequest {
    @Size(max = 500, message = "Notes too long")
    private String notes;
}
