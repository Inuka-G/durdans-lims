package com.uom.lims.api.dto.response;

import com.uom.lims.api.enums.Priority;
import com.uom.lims.api.enums.RejectionReason;
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
 * WHY: Transmits execution-ready specimen requirements to drive dynamic phlebotomy queue interactions.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SampleResponse {
    private UUID id;
    private String sampleId;
    private String orderId;
    private Priority priority;
    private String testType;
    private List<String> testCodes;
    private List<TubeType> tubeTypes;
    private long waitTimeMinutes;
    private SampleStatus status;
    private SamplePatientInfo patient;
    private Instant collectedAt;
    private String collectedBy;
    private RejectionReason rejectionReason;
    private String rejectionNotes;
    private int printCount;
}
