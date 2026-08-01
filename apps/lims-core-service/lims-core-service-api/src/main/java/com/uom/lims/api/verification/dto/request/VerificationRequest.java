package com.uom.lims.api.verification.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerificationRequest {
    private String resultId;

    private String status;

    private String mltNotes;

    private String supervisorNote;

    /**
     * Required only when releasing results whose internal QC did not pass. A
     * supervisor-level role must state why the run is being released over an
     * out-of-control, stale or absent control; the reason is stored on each
     * result and written to the tamper-evident audit log.
     *
     * <p>Supplying it does NOT change the recorded QC status — a failed control
     * still reads FAIL everywhere afterwards. Laundering a failure into a pass
     * is the exact outcome the gate exists to prevent.
     */
    private String qcOverrideReason;
}
