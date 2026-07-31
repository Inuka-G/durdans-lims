package com.uom.lims.api.dto.request;

import com.uom.lims.api.enums.RejectionReason;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * WHY: Signals a pre-analytical failure requiring formal documentation for quality metrics.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SampleRejectRequest {
    @NotNull(message = "Rejection reason is required")
    private RejectionReason rejectionReason;

    @Size(max = 500, message = "Rejection notes too long")
    private String rejectionNotes;
}
