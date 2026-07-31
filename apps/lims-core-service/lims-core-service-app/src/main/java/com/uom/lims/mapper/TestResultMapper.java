package com.uom.lims.mapper;

import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.verification.dto.response.PreviousVisitSummaryResponse;
import com.uom.lims.api.verification.dto.response.TestResultDetailResponse;
import com.uom.lims.api.verification.dto.response.TestResultParameterResponse;
import com.uom.lims.api.verification.dto.response.TestResultSummaryResponse;
import com.uom.lims.entity.TestResultEntity;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

@Component
public class TestResultMapper {
    private static final String MLT_NOTE_MARKER = "[MLT_NOTE]";
    private static final String SUPERVISOR_NOTE_MARKER = "[SUPERVISOR_NOTE]";

    public TestResultSummaryResponse toSummaryResponse(TestResultEntity entity) {
        return toSummaryResponse(entity, null, null);
    }

    public TestResultSummaryResponse toSummaryResponse(TestResultEntity entity, String testType) {
        return toSummaryResponse(entity, testType, null);
    }

    public TestResultSummaryResponse toSummaryResponse(
            TestResultEntity entity,
            String testType,
            String patientName) {
        String pathologistName = entity.getClinicallyAuthorizedBy() != null && !entity.getClinicallyAuthorizedBy().isBlank()
                ? entity.getClinicallyAuthorizedBy()
                : entity.getReturnedBy();

        return TestResultSummaryResponse.builder()
                .resultId(entity.getId().toString())
                .status(entity.getStatus() == null ? null : entity.getStatus().name())
                .patientName(patientName)
                .testType(testType)
                .mltName(entity.getCreatedBy())
                .qcStatus("Not Linked")
                .flag(entity.getFlag() == null ? null : entity.getFlag().name())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getLastModifiedAt())
                .technicianName(entity.getTechnicallyVerifiedBy())
                .pathologistName(pathologistName)
                .returnReason(entity.getReturnReason())
                .build();
    }

    public TestResultDetailResponse toDetailResponse(
            TestResultEntity entity,
            List<TestResultEntity> caseResults,
            String patientCode,
            String patientName,
            String testType,
            Integer patientAge,
            String patientGender,
            List<PreviousVisitSummaryResponse> previousVisits
    ) {
        String pathologistName = entity.getClinicallyAuthorizedBy() != null && !entity.getClinicallyAuthorizedBy().isBlank()
                ? entity.getClinicallyAuthorizedBy()
                : entity.getReturnedBy();

        List<TestResultParameterResponse> parameters = caseResults.stream()
                .sorted(Comparator
                        .comparing((TestResultEntity result) -> result.getParameter().getDisplayOrder(),
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(result -> result.getParameter().getName(), String.CASE_INSENSITIVE_ORDER))
                .map(this::toParameterResponse)
                .toList();

        return TestResultDetailResponse.builder()
                .resultId(entity.getId().toString())
                .status(entity.getStatus() == null ? null : entity.getStatus().name())
                .patientCode(patientCode)
                .patientName(patientName)
                .patientAge(patientAge)
                .patientGender(patientGender)
                .testType(testType)
                .priority(resolvePriority(entity))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getLastModifiedAt())
                .mltName(entity.getCreatedBy())
                .supervisorName(entity.getTechnicallyVerifiedBy())
                .technicianName(entity.getTechnicallyVerifiedBy())
                .pathologistName(pathologistName)
                .authorizedAt(entity.getClinicallyAuthorizedAt())
                .parameters(parameters)
                .previousVisits(previousVisits)
                .clinicalNote(entity.getClinicalNote())
                .mltNotes(extractMltNotes(entity.getMltNotes()))
                .supervisorNote(extractSupervisorNote(entity.getMltNotes()))
                .build();
    }

    public TestResultDetailResponse toDetailResponse(TestResultEntity entity) {
        return toDetailResponse(entity, List.of(entity), null, null, null, null, null, List.of());
    }

    private TestResultParameterResponse toParameterResponse(TestResultEntity entity) {
        return TestResultParameterResponse.builder()
                .parameterCode(entity.getParameter().getId().toString())
                .parameterName(entity.getParameter().getName())
                .resultValue(toBigDecimal(entity.getResultValue()))
                .resultText(entity.getResultValue())
                .unit(entity.getParameter().getUnit())
                .referenceRangeLow(entity.getParameter().getRefLow())
                .referenceRangeHigh(entity.getParameter().getRefHigh())
                .flag(entity.getFlag() == null ? null : entity.getFlag().name())
                .build();
    }

    private BigDecimal toBigDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    /**
     * Worklist priority follows specimen / order triage (STAT &gt; URGENT &gt; NORMAL).
     * Panic flags remain visible per-analyte in the results grid — not as a single collapsed “priority”.
     */
    private String resolvePriority(TestResultEntity entity) {
        return entity.getSample().getPriority() == null ? null : entity.getSample().getPriority().name();
    }

    private String extractMltNotes(String storedNotes) {
        if (storedNotes == null || storedNotes.isBlank()) {
            return storedNotes;
        }

        if (!storedNotes.contains(MLT_NOTE_MARKER) && !storedNotes.contains(SUPERVISOR_NOTE_MARKER)) {
            return storedNotes;
        }

        return extractSection(storedNotes, MLT_NOTE_MARKER);
    }

    private String extractSupervisorNote(String storedNotes) {
        if (storedNotes == null || storedNotes.isBlank() || !storedNotes.contains(SUPERVISOR_NOTE_MARKER)) {
            return null;
        }

        String supervisorNote = extractSection(storedNotes, SUPERVISOR_NOTE_MARKER);
        if (supervisorNote == null) {
            return null;
        }

        if (supervisorNote.startsWith("Added by ")) {
            int separatorIndex = supervisorNote.indexOf(':');
            if (separatorIndex >= 0 && separatorIndex + 1 < supervisorNote.length()) {
                return supervisorNote.substring(separatorIndex + 1).trim();
            }
        }

        return supervisorNote;
    }

    private String extractSection(String storedNotes, String marker) {
        int markerIndex = storedNotes.indexOf(marker);
        if (markerIndex < 0) {
            return null;
        }

        int contentStart = markerIndex + marker.length();
        while (contentStart < storedNotes.length()
                && (storedNotes.charAt(contentStart) == '\n' || storedNotes.charAt(contentStart) == '\r')) {
            contentStart++;
        }

        int nextMltIndex = storedNotes.indexOf(MLT_NOTE_MARKER, contentStart);
        int nextSupervisorIndex = storedNotes.indexOf(SUPERVISOR_NOTE_MARKER, contentStart);
        int nextMarkerIndex = -1;

        if (nextMltIndex >= 0 && nextSupervisorIndex >= 0) {
            nextMarkerIndex = Math.min(nextMltIndex, nextSupervisorIndex);
        } else if (nextMltIndex >= 0) {
            nextMarkerIndex = nextMltIndex;
        } else if (nextSupervisorIndex >= 0) {
            nextMarkerIndex = nextSupervisorIndex;
        }

        String section = nextMarkerIndex >= 0
                ? storedNotes.substring(contentStart, nextMarkerIndex)
                : storedNotes.substring(contentStart);

        String trimmed = section.trim();
        return trimmed.isBlank() ? null : trimmed;
    }
}
