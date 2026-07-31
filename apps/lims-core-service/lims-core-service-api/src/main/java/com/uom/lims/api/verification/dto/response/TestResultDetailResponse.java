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
}
