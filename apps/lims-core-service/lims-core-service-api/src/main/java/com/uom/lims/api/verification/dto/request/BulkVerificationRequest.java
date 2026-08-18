package com.uom.lims.api.verification.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkVerificationRequest {
    @NotEmpty
    private List<String> resultIds;
    private String status;
    private String mltNotes;
    /** Supervisor's remark for the whole batch, captured in the approval modal. */
    private String supervisorNote;
}
