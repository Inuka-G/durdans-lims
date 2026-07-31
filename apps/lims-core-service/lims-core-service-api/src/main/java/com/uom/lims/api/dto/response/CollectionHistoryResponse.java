package com.uom.lims.api.dto.response;

import com.uom.lims.api.enums.Priority;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.enums.TubeType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * WHY: Outputs historical metrics for collected specimens to facilitate supervisor audits and traceability.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CollectionHistoryResponse {
    private UUID id;
    private String sampleId;
    private String patientName;
    private String pid;
    private List<String> testCodes;
    private TubeType tubeType;
    private Priority priority;
    private SampleStatus status;
    private Instant collectedAt;
    private String collectedBy;
    private long waitTime;
    private String rejectionNotes;
    /** Total label prints recorded for this specimen (initial print + reprints). */
    private int printCount;
}
