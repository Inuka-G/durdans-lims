package com.uom.lims.mapper;

import com.uom.lims.api.verification.dto.response.PreviousVisitSummaryResponse;
import com.uom.lims.api.verification.dto.response.TestResultDetailResponse;
import com.uom.lims.api.verification.dto.response.TestResultParameterResponse;
import com.uom.lims.api.verification.dto.response.TestResultSummaryResponse;
import com.uom.lims.autoverification.AutoverificationService;
import com.uom.lims.entity.OrderEntity;
import com.uom.lims.entity.OrderItemEntity;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestResultEntity;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Component
public class TestResultMapper {

    private static final String MLT_NOTE_MARKER = "[MLT_NOTE]";
    private static final String SUPERVISOR_NOTE_MARKER = "[SUPERVISOR_NOTE]";
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public TestResultSummaryResponse toSummaryResponse(TestResultEntity entity) {
        return toSummaryResponse(entity, null, null, null);
    }

    public TestResultSummaryResponse toSummaryResponse(TestResultEntity entity, String testType) {
        return toSummaryResponse(entity, testType, null, null);
    }

    public TestResultSummaryResponse toSummaryResponse(
            TestResultEntity entity,
            String testType,
            String patientName) {
        return toSummaryResponse(entity, testType, patientName, null);
    }

    /**
     * @param patientCode shown beside the name in the supervisor and pathologist
     *                    queues so a case can be found by ID as well as by name.
     */
    public TestResultSummaryResponse toSummaryResponse(
            TestResultEntity entity,
            String testType,
            String patientName,
            String patientCode) {
        String pathologistName = entity.getClinicallyAuthorizedBy() != null && !entity.getClinicallyAuthorizedBy().isBlank()
                ? entity.getClinicallyAuthorizedBy()
                : entity.getReturnedBy();

        return TestResultSummaryResponse.builder()
                .resultId(entity.getId().toString())
                .resultNo(resultNoOf(entity))
                .status(entity.getStatus() == null ? null : entity.getStatus().name())
                .patientCode(patientCode)
                .patientName(patientName)
                .testType(testType)
                .mltName(entity.getCreatedBy())
                // Was the literal "Not Linked" for every result ever produced — the
                // visible symptom of QC having no connection to results at all. Now
                // the verdict frozen when the result was measured.
                .qcStatus(entity.getQcStatus() == null ? "NOT_EVALUATED" : entity.getQcStatus())
                .flag(entity.getFlag() == null ? null : entity.getFlag().name())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getLastModifiedAt())
                .technicianName(entity.getTechnicallyVerifiedBy())
                .pathologistName(pathologistName)
                .returnReason(entity.getReturnReason())
                .build();
    }

    /** Detail without delta or specimen-receipt context — kept for callers that have neither. */
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
        return toDetailResponse(entity, caseResults, patientCode, patientName, testType,
                patientAge, patientGender, previousVisits, Map.of(), null);
    }

    /**
     * @param priorByParameterId the patient's most recent released value per
     *                           parameter id (previous visit), for the delta column;
     *                           empty when the patient has no earlier visit.
     * @param receivedAt         when accessioning accepted the specimen, if known.
     */
    public TestResultDetailResponse toDetailResponse(
            TestResultEntity entity,
            List<TestResultEntity> caseResults,
            String patientCode,
            String patientName,
            String testType,
            Integer patientAge,
            String patientGender,
            List<PreviousVisitSummaryResponse> previousVisits,
            Map<UUID, TestResultEntity> priorByParameterId,
            Instant receivedAt
    ) {
        String pathologistName = entity.getClinicallyAuthorizedBy() != null && !entity.getClinicallyAuthorizedBy().isBlank()
                ? entity.getClinicallyAuthorizedBy()
                : entity.getReturnedBy();

        List<TestResultParameterResponse> parameters = caseResults.stream()
                .sorted(Comparator
                        .comparing((TestResultEntity result) -> result.getParameter().getDisplayOrder(),
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(result -> result.getParameter().getName(), String.CASE_INSENSITIVE_ORDER))
                .map(result -> toParameterResponse(
                        result,
                        priorByParameterId == null || result.getParameter() == null
                                ? null
                                : priorByParameterId.get(result.getParameter().getId())))
                .toList();

        SampleEntity sample = entity.getSample();
        OrderEntity order = orderOf(sample);

        // The last return on the case, whichever direction it went. Every row of the
        // case is stamped together, so the newest returnedAt across them is the one.
        TestResultEntity lastReturned = caseResults.stream()
                .filter(result -> result.getReturnedAt() != null)
                .max(Comparator.comparing(TestResultEntity::getReturnedAt))
                .orElse(entity.getReturnedAt() != null || entity.getReturnReason() != null ? entity : null);

        Instant measuredAt = caseResults.stream()
                .map(TestResultEntity::getMeasuredAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);

        return TestResultDetailResponse.builder()
                .resultId(entity.getId().toString())
                .resultNo(sample == null ? null : sample.getResultNo())
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
                .sampleBarcode(sample == null ? null : sample.getBarcode())
                .tubeType(sample == null || sample.getTubeType() == null ? null : sample.getTubeType().name())
                .collectedAt(sample == null ? null : sample.getCollectedAt())
                .collectedBy(sample == null ? null : sample.getCollectedBy())
                .receivedAt(receivedAt)
                .measuredAt(measuredAt)
                .referringDoctor(order == null ? null : order.getReferringDoctor())
                .referringDepartment(order == null ? null : order.getReferringDepartment())
                .returnReason(lastReturned == null ? null : lastReturned.getReturnReason())
                .returnedBy(lastReturned == null ? null : lastReturned.getReturnedBy())
                .returnedAt(lastReturned == null ? null : lastReturned.getReturnedAt())
                .build();
    }

    public TestResultDetailResponse toDetailResponse(TestResultEntity entity) {
        return toDetailResponse(entity, List.of(entity), null, null, null, null, null, List.of());
    }

    private TestResultParameterResponse toParameterResponse(TestResultEntity entity, TestResultEntity prior) {
        TestResultParameterResponse.TestResultParameterResponseBuilder builder = TestResultParameterResponse.builder()
                .parameterCode(entity.getParameter().getId().toString())
                .parameterName(entity.getParameter().getName())
                .resultValue(toBigDecimal(entity.getResultValue()))
                .resultText(entity.getResultValue())
                .unit(entity.getParameter().getUnit())
                .referenceRangeLow(entity.getParameter().getRefLow())
                .referenceRangeHigh(entity.getParameter().getRefHigh())
                .flag(entity.getFlag() == null ? null : entity.getFlag().name());

        if (prior != null) {
            SampleEntity priorSample = prior.getSample();
            builder.previousValue(prior.getResultValue())
                    .previousFlag(prior.getFlag() == null ? null : prior.getFlag().name())
                    .previousVisitedAt(priorSample == null
                            ? null
                            : priorSample.getCollectedAt() != null ? priorSample.getCollectedAt() : priorSample.getCreatedAt())
                    .previousSampleBarcode(priorSample == null ? null : priorSample.getBarcode());

            BigDecimal current = numericOf(entity);
            BigDecimal previous = numericOf(prior);
            if (current != null && previous != null) {
                BigDecimal deltaAbsolute = current.subtract(previous);
                builder.deltaAbsolute(deltaAbsolute);
                if (previous.signum() != 0) {
                    // Signed, so the reader sees direction as well as size; rounded to
                    // one decimal because that is the precision a clinician reads it at.
                    BigDecimal deltaPercent = deltaAbsolute
                            .divide(previous.abs(), 6, RoundingMode.HALF_UP)
                            .multiply(HUNDRED)
                            .setScale(1, RoundingMode.HALF_UP);
                    builder.deltaPercent(deltaPercent)
                            .deltaSignificant(deltaPercent.abs().doubleValue() > AutoverificationService.DELTA_THRESHOLD_PCT);
                }
            }
        }

        return builder.build();
    }

    /** The numeric form of a result: the indexed column when present, else a parse of the text. */
    private static BigDecimal numericOf(TestResultEntity entity) {
        if (entity.getResultNumeric() != null) {
            return entity.getResultNumeric();
        }
        return toBigDecimal(entity.getResultValue());
    }

    private static String resultNoOf(TestResultEntity entity) {
        SampleEntity sample = entity.getSample();
        return sample == null ? null : sample.getResultNo();
    }

    private static OrderEntity orderOf(SampleEntity sample) {
        if (sample == null) {
            return null;
        }
        OrderItemEntity item = sample.getOrderItem();
        return item == null ? null : item.getOrder();
    }

    private static BigDecimal toBigDecimal(String value) {
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
