package com.uom.lims.api.verification.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestResultDetailResponse {
    private String resultId;
    /** Human-readable case number (RES<year>-<sequence>) shared by every parameter of the specimen. */
    private String resultNo;
    private String status;
    private String patientCode;
    private String patientName;
    private Integer patientAge;
    private String patientGender;
    private String testType;
    private String priority;
    private Instant createdAt;
    private Instant updatedAt;
    private String mltName;
    private String supervisorName;
    private String technicianName;
    private String pathologistName;
    private Instant authorizedAt;
    private List<TestResultParameterResponse> parameters;
    private List<PreviousVisitSummaryResponse> previousVisits;
    private String clinicalNote;
    private String mltNotes;
    private String supervisorNote;

    // ---- Specimen / encounter context for the review header ----
    private String sampleBarcode;
    private String tubeType;
    private Instant collectedAt;
    private String collectedBy;
    /** When accessioning accepted the specimen into the lab (from the accessioning audit trail). */
    private Instant receivedAt;
    /** When the analyser / MLT recorded the latest value on this case. */
    private Instant measuredAt;
    private String referringDoctor;
    private String referringDepartment;

    // ---- Last return, in either direction (supervisor -> MLT, pathologist -> supervisor) ----
    private String returnReason;
    private String returnedBy;
    private Instant returnedAt;
}
