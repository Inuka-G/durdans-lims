package com.uom.lims.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.api.dto.response.VerificationPendingItemResponse;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.verification.dto.request.BulkVerificationRequest;
import com.uom.lims.api.verification.dto.request.VerificationRequest;
import com.uom.lims.api.verification.dto.response.BulkVerificationBatchResponse;
import com.uom.lims.api.verification.dto.response.PreviousVisitSummaryResponse;
import com.uom.lims.api.verification.dto.response.TestResultDetailResponse;
import com.uom.lims.api.verification.dto.response.TestResultSummaryResponse;
import com.uom.lims.api.verification.dto.response.VerificationHistoryItemResponse;
import com.uom.lims.audit.AuditLog;
import com.uom.lims.audit.AuditLogRepository;
import com.uom.lims.audit.AuditService;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.mapper.TestResultMapper;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.repository.SampleRepository;
import com.uom.lims.repository.TestCatalogRepository;
import com.uom.lims.repository.TestResultRepository;
import com.uom.lims.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Period;
import java.time.Instant;
import java.util.HashMap;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@RequiredArgsConstructor
@Service
public class VerificationService {

    /**
     * Self-reference (lazy to avoid a constructor cycle) so bulkVerify can invoke
     * verifyResult through the Spring proxy — a plain {@code this.verifyResult()}
     * would bypass AOP and ignore its REQUIRES_NEW transaction boundary.
     */
    @org.springframework.beans.factory.annotation.Autowired
    @org.springframework.context.annotation.Lazy
    private VerificationService self;

    private static final String VERIFICATION_ENTITY_TYPE = "VERIFICATION";
    private static final String ACTION_VERIFICATION_APPROVED = "VERIFICATION_APPROVED";
    private static final String ACTION_RETURNED_TO_MLT = "VERIFICATION_RETURNED_TO_MLT";
    private static final String ACTION_RETURNED_FROM_CLINICAL = "VERIFICATION_RETURNED_FROM_CLINICAL";
    private static final List<String> VERIFICATION_HISTORY_ACTIONS = List.of(
            ACTION_VERIFICATION_APPROVED,
            ACTION_RETURNED_TO_MLT,
            ACTION_RETURNED_FROM_CLINICAL
    );
    private static final String MLT_NOTE_MARKER = "[MLT_NOTE]";
    private static final String SUPERVISOR_NOTE_MARKER = "[SUPERVISOR_NOTE]";

    private final AuditService auditService;
    private final AuditLogRepository auditLogRepository;
    private final SampleRepository sampleRepository;
    private final TestResultRepository testResultRepository;
    private final TestCatalogRepository testCatalogRepository;
    private final TestResultMapper testResultMapper;
    private final PatientRepository patientRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<VerificationPendingItemResponse> getPendingSamples() {
        List<SampleEntity> samples = sampleRepository.findByStatusInAndDeletedFalseOrderByCollectedAtAsc(
                List.of(SampleStatus.SENT_FOR_VERIFICATION));

        List<UUID> testIds = samples.stream()
                .map(sample -> sample.getOrderItem().getTestId())
                .distinct()
                .toList();

        Map<UUID, String> testNameById = testCatalogRepository.findAllById(testIds).stream()
                .collect(Collectors.toMap(
                        TestCatalogEntity::getId,
                        TestCatalogEntity::getTestName,
                        (existing, replacement) -> existing));

        List<UUID> sampleIds = samples.stream()
                .map(SampleEntity::getId)
                .toList();

        Map<UUID, List<TestResultEntity>> resultsBySampleId = testResultRepository.findBySampleIdIn(sampleIds)
                .stream()
                .collect(Collectors.groupingBy(result -> result.getSample().getId()));

        Map<String, String> patientNameByCode = samples.stream()
                .map(sample -> sample.getOrderItem().getOrder().getPatientId())
                .distinct()
                .collect(Collectors.toMap(
                        Function.identity(),
                        patientCode -> patientRepository.findByPatientCode(patientCode)
                                .map(PatientEntity::getFullName)
                                .orElse("UNKNOWN_PATIENT")));

        return samples.stream()
                .map(sample -> {
                    List<TestResultEntity> results = resultsBySampleId.getOrDefault(sample.getId(), List.of());
                    TestResultEntity latestResult = results.stream()
                            .max(Comparator.comparing(
                                    result -> result.getLastModifiedAt() != null
                                            ? result.getLastModifiedAt()
                                            : result.getCreatedAt()))
                            .orElse(null);

                    ResultFlag overallFlag = results.stream()
                            .map(TestResultEntity::getFlag)
                            .filter(flag -> flag != null)
                            .max(Comparator.comparingInt(this::flagSeverity))
                            .orElse(null);

                    return new VerificationPendingItemResponse(
                            sample.getId(),
                            sample.getBarcode(),
                            sample.getOrderItem().getOrder().getId(),
                            sample.getOrderItem().getOrder().getPatientId(),
                            patientNameByCode.getOrDefault(
                                    sample.getOrderItem().getOrder().getPatientId(),
                                    "UNKNOWN_PATIENT"),
                            testNameById.getOrDefault(sample.getOrderItem().getTestId(), "UNKNOWN_TEST"),
                            sample.getPriority().name(),
                            sample.getStatus().name(),
                            overallFlag != null ? overallFlag.name() : null,
                            latestResult != null
                                    ? (latestResult.getLastModifiedBy() != null
                                            ? latestResult.getLastModifiedBy()
                                            : latestResult.getCreatedBy())
                                    : null,
                            sample.getLastModifiedAt());
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<TestResultSummaryResponse> getPendingResults(int page, int size) {
        Pageable pageable = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Order.desc("lastModifiedAt"), Sort.Order.desc("id")));
        Page<SampleEntity> samplesPage = sampleRepository.findByStatusInAndBranch(
                List.of(SampleStatus.SENT_FOR_VERIFICATION),
                SecurityUtils.resolveBranchScope(),
                pageable);

        List<UUID> testIds = samplesPage.getContent().stream()
                .map(sample -> sample.getOrderItem().getTestId())
                .distinct()
                .toList();

        Map<UUID, String> testNamesById = testIds.isEmpty()
                ? Map.of()
                : testCatalogRepository.findAllByIdInAndActiveTrueAndDeletedFalse(testIds).stream()
                .collect(Collectors.toMap(TestCatalogEntity::getId, TestCatalogEntity::getTestName));

        Map<String, String> patientNamesById = new HashMap<>();
        samplesPage.getContent().stream()
                .map(sample -> sample.getOrderItem().getOrder().getPatientId())
                .filter(patientId -> patientId != null && !patientId.isBlank())
                .distinct()
                .forEach(patientId -> patientNamesById.put(patientId, safelyResolvePatientName(patientId)));

        return samplesPage.map(sample -> buildSupervisorQueueSummary(sample, testNamesById, patientNamesById));
    }

    /**
     * One dashboard row per specimen/test order — not per analyte/parameter row.
     */
    private TestResultSummaryResponse buildSupervisorQueueSummary(
            SampleEntity sample,
            Map<UUID, String> testNamesById,
            Map<String, String> patientNamesById) {
        List<TestResultEntity> pending = testResultRepository.findBySampleId(sample.getId()).stream()
                .filter(tr -> !tr.isDeleted())
                .filter(tr -> !Boolean.TRUE.equals(tr.getDraft()))
                .filter(tr -> tr.getStatus() == ResultStatus.ENTERED
                        || tr.getStatus() == ResultStatus.RETURNED_FOR_RECHECK)
                .toList();

        if (pending.isEmpty()) {
            TestResultEntity fallback = testResultRepository.findBySampleId(sample.getId()).stream()
                    .filter(tr -> !tr.isDeleted())
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException(
                            "No test results for sample in supervisor queue: " + sample.getId()));
            UUID testId = sample.getOrderItem().getTestId();
            String patientId = sample.getOrderItem().getOrder().getPatientId();
            TestResultSummaryResponse base = testResultMapper.toSummaryResponse(
                    fallback,
                    testNamesById.getOrDefault(testId, "UNKNOWN_TEST"),
                    patientNamesById.getOrDefault(patientId, "UNKNOWN_PATIENT"));
            List<TestResultEntity> submittedResults = testResultRepository.findBySampleId(sample.getId()).stream()
                    .filter(tr -> !tr.isDeleted())
                    .filter(tr -> !Boolean.TRUE.equals(tr.getDraft()))
                    .toList();
            ResultFlag overallFlag = resolveOverallFlag(submittedResults);
            boolean criticalFinding = hasCriticalFinding(submittedResults);
            return TestResultSummaryResponse.builder()
                    .resultId(base.getResultId())
                    .status(base.getStatus())
                    .patientName(base.getPatientName())
                    .testType(base.getTestType())
                    .mltName(base.getMltName())
                    .qcStatus(base.getQcStatus())
                    .flag(overallFlag == null ? null : overallFlag.name())
                    .priorityLevel(sample.getPriority() == null ? null : sample.getPriority().name())
                    .hasCriticalFinding(criticalFinding)
                    .createdAt(base.getCreatedAt())
                    .updatedAt(sample.getLastModifiedAt() != null ? sample.getLastModifiedAt() : base.getUpdatedAt())
                    .technicianName(base.getTechnicianName())
                    .pathologistName(base.getPathologistName())
                    .returnReason(base.getReturnReason())
                    .build();
        }

        TestResultEntity primary = pending.stream()
                .min(Comparator
                        .comparing((TestResultEntity tr) -> tr.getParameter().getDisplayOrder(),
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(tr -> tr.getParameter().getName(), String.CASE_INSENSITIVE_ORDER))
                .orElse(pending.get(0));

        ResultFlag overallFlag = resolveOverallFlag(pending);
        boolean hasCriticalFinding = hasCriticalFinding(pending);

        String aggregateStatus = pending.stream()
                        .anyMatch(tr -> tr.getStatus() == ResultStatus.RETURNED_FOR_RECHECK)
                ? ResultStatus.RETURNED_FOR_RECHECK.name()
                : ResultStatus.ENTERED.name();

        UUID testId = sample.getOrderItem().getTestId();
        String patientId = sample.getOrderItem().getOrder().getPatientId();
        String testName = testNamesById.getOrDefault(testId, "UNKNOWN_TEST");
        String patientName = patientNamesById.getOrDefault(patientId, "UNKNOWN_PATIENT");

        TestResultSummaryResponse base = testResultMapper.toSummaryResponse(primary, testName, patientName);
        return TestResultSummaryResponse.builder()
                .resultId(base.getResultId())
                .status(aggregateStatus)
                .patientName(base.getPatientName())
                .testType(base.getTestType())
                .mltName(base.getMltName())
                .qcStatus(base.getQcStatus())
                .flag(overallFlag == null ? null : overallFlag.name())
                .priorityLevel(sample.getPriority() == null ? null : sample.getPriority().name())
                .hasCriticalFinding(hasCriticalFinding)
                .createdAt(base.getCreatedAt())
                .updatedAt(sample.getLastModifiedAt() != null ? sample.getLastModifiedAt() : base.getUpdatedAt())
                .technicianName(base.getTechnicianName())
                .pathologistName(base.getPathologistName())
                .returnReason(pending.stream()
                        .map(TestResultEntity::getReturnReason)
                        .filter(reason -> reason != null && !reason.isBlank())
                        .findFirst()
                        .orElse(base.getReturnReason()))
                .build();
    }

    @Transactional(readOnly = true)
    public List<BulkVerificationBatchResponse> getBulkWorklist() {
        List<TestResultEntity> pendingResults = testResultRepository.findSupervisorPendingResults(
                ResultStatus.ENTERED,
                ResultStatus.RETURNED_FOR_RECHECK,
                SampleStatus.SENT_FOR_VERIFICATION);

        Map<UUID, TestCatalogEntity> catalogsById = testCatalogRepository.findAllByIdInAndActiveTrueAndDeletedFalse(
                        pendingResults.stream()
                                .map(result -> result.getSample().getOrderItem().getTestId())
                                .distinct()
                                .toList()
                ).stream()
                .collect(Collectors.toMap(TestCatalogEntity::getId, catalog -> catalog));

        return pendingResults.stream()
                .collect(Collectors.groupingBy(result -> result.getSample().getOrderItem().getTestId()))
                .entrySet().stream()
                .map(entry -> toBulkBatchResponse(entry.getKey(), entry.getValue(), catalogsById.get(entry.getKey())))
                .sorted(
                        Comparator.comparing(
                                BulkVerificationBatchResponse::getUpdatedAt,
                                Comparator.nullsLast(Comparator.reverseOrder())
                        ).thenComparing(
                                BulkVerificationBatchResponse::getBatchName,
                                String.CASE_INSENSITIVE_ORDER
                        )
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<VerificationHistoryItemResponse> getVerificationHistory(
            int page,
            int size,
            String actionType,
            String search
    ) {
        List<String> actions = resolveHistoryActions(actionType, VERIFICATION_HISTORY_ACTIONS);
        if (actions.isEmpty()) {
            return Page.empty(PageRequest.of(page, size));
        }

        return auditLogRepository
                .findHistoryByEntityTypeAndActions(
                        VERIFICATION_ENTITY_TYPE,
                        actions,
                        normalizeSearch(search),
                        PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"))
                )
                .map(this::toHistoryItemResponse);
    }

    @Transactional(readOnly = true)
    public TestResultDetailResponse getResultDetails(UUID resultId) {
        TestResultEntity result = findResultById(resultId);
        List<TestResultEntity> caseResults = testResultRepository.findBySampleId(result.getSample().getId());
        String patientId = safelyResolvePatientId(result);

        UUID testId = safelyResolveTestId(result);
        String testType = testId == null
                ? null
                : testCatalogRepository.findById(testId)
                .filter(TestCatalogEntity::isActive)
                .filter(catalog -> !catalog.isDeleted())
                .map(TestCatalogEntity::getTestName)
                .orElse(null);

        PatientEntity patient = safelyResolvePatientEntity(patientId);
        String patientName = patient != null ? patient.getFullName() : null;
        Integer patientAge = patient == null ? null : calculatePatientAge(patient);
        String patientGender = patient == null || patient.getGender() == null ? null : patient.getGender().name();
        List<PreviousVisitSummaryResponse> previousVisits = resolvePreviousVisits(
                patientId,
                testId,
                result.getSample().getId()
        );

        return testResultMapper.toDetailResponse(
                result,
                caseResults,
                patientId,
                patientName,
                testType,
                patientAge,
                patientGender,
                previousVisits
        );
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public TestResultDetailResponse verifyResult(UUID resultId, VerificationRequest request) {
        TestResultEntity anchor = findResultById(resultId);

        if (anchor.getStatus() != ResultStatus.ENTERED
                && anchor.getStatus() != ResultStatus.RETURNED_FOR_RECHECK) {
            throw new IllegalStateException(
                    "Cannot verify result not in ENTERED or RETURNED_FOR_RECHECK status. Current: "
                            + anchor.getStatus());
        }

        String username = SecurityUtils.getCurrentUsername();
        Instant now = Instant.now();
        String storedNotes = composeStoredNotes(request.getMltNotes(), request.getSupervisorNote());
        String historyNotes = resolveApprovalHistoryNotes(request.getSupervisorNote());

        List<TestResultEntity> targets = testResultRepository.findBySampleId(anchor.getSample().getId()).stream()
                .filter(tr -> !tr.isDeleted())
                .filter(tr -> !Boolean.TRUE.equals(tr.getDraft()))
                .filter(tr -> tr.getStatus() == ResultStatus.ENTERED
                        || tr.getStatus() == ResultStatus.RETURNED_FOR_RECHECK)
                .toList();

        if (targets.isEmpty()) {
            throw new IllegalStateException("No pending parameter results to verify for this sample.");
        }

        SampleEntity sample = anchor.getSample();
        sample.setStatus(SampleStatus.VERIFIED);

        for (TestResultEntity result : targets) {
            result.setStatus(ResultStatus.TECHNICALLY_VERIFIED);
            result.setMltNotes(storedNotes);
            result.setTechnicallyVerifiedBy(username);
            result.setTechnicallyVerifiedAt(now);
            result.setLastModifiedBy(username);
            result.setLastModifiedAt(now);
            testResultRepository.save(result);
        }

        logVerificationEvent(anchor, ACTION_VERIFICATION_APPROVED, historyNotes);
        return getResultDetails(resultId);
    }

    @Transactional
    public TestResultDetailResponse rejectResult(UUID resultId, VerificationRequest request) {
        TestResultEntity anchor = findResultById(resultId);

        if (anchor.getStatus() != ResultStatus.ENTERED
                && anchor.getStatus() != ResultStatus.RETURNED_FOR_RECHECK) {
            throw new IllegalStateException(
                    "Cannot reject result not in ENTERED or RETURNED_FOR_RECHECK status. Current: "
                            + anchor.getStatus());
        }

        String username = SecurityUtils.getCurrentUsername();
        Instant now = Instant.now();
        String storedNotes = composeStoredNotes(request.getMltNotes(), request.getSupervisorNote());

        List<TestResultEntity> targets = testResultRepository.findBySampleId(anchor.getSample().getId()).stream()
                .filter(tr -> !tr.isDeleted())
                .filter(tr -> !Boolean.TRUE.equals(tr.getDraft()))
                .filter(tr -> tr.getStatus() == ResultStatus.ENTERED
                        || tr.getStatus() == ResultStatus.RETURNED_FOR_RECHECK)
                .toList();

        if (targets.isEmpty()) {
            throw new IllegalStateException("No pending parameter results to return to MLT for this sample.");
        }

        SampleEntity sample = anchor.getSample();
        sample.setStatus(SampleStatus.IN_TESTING);

        for (TestResultEntity result : targets) {
            result.setStatus(ResultStatus.RETURNED_FOR_RECHECK);
            result.setMltNotes(storedNotes);
            // Do NOT stamp technicallyVerifiedBy/At on a reject — the result was
            // returned, not verified. lastModified captures who/when.
            result.setLastModifiedBy(username);
            result.setLastModifiedAt(now);
            testResultRepository.save(result);
        }

        logVerificationEvent(anchor, ACTION_RETURNED_TO_MLT, resolveHistoryNotes(
                ACTION_RETURNED_TO_MLT,
                sanitizeHistoryNote(extractMltNote(storedNotes))));
        return getResultDetails(resultId);
    }

    /**
     * Verifies each result in its own transaction (via the self-proxy so the
     * REQUIRES_NEW boundary applies). A failure on one result rolls back only
     * that result and is reported as FAILED; successes are committed and the
     * returned map is truthful. (Previously the self-invocation shared a single
     * transaction, so any failure silently rolled back the whole batch while the
     * response still reported VERIFIED.)
     */
    public Map<String, String> bulkVerify(BulkVerificationRequest request) {
        Map<String, String> resultMap = new LinkedHashMap<>();

        for (String resultIdValue : request.getResultIds()) {
            try {
                UUID resultId = UUID.fromString(resultIdValue);
                VerificationRequest verificationRequest = VerificationRequest.builder()
                        .mltNotes(request.getMltNotes())
                        .build();

                self.verifyResult(resultId, verificationRequest);
                resultMap.put(resultIdValue, "VERIFIED");
            } catch (Exception exception) {
                resultMap.put(resultIdValue, "FAILED: " + exception.getMessage());
            }
        }

        return resultMap;
    }

    private TestResultEntity findResultById(UUID id) {
        return testResultRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Test result not found: " + id));
    }

    private List<String> resolveHistoryActions(String actionType, List<String> allowedActions) {
        if (actionType == null || actionType.isBlank()) {
            return allowedActions;
        }

        return allowedActions.contains(actionType) ? List.of(actionType) : List.of();
    }

    private String normalizeSearch(String search) {
        if (search == null) {
            return null;
        }

        String trimmed = search.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private BulkVerificationBatchResponse toBulkBatchResponse(
            UUID testId,
            List<TestResultEntity> results,
            TestCatalogEntity catalog
    ) {
        List<TestResultEntity> safeResults = results.stream()
                .filter(this::isSafeForBulkApproval)
                .toList();
        List<TestResultEntity> reviewResults = results.stream()
                .filter(result -> !isSafeForBulkApproval(result))
                .toList();

        Instant updatedAt = results.stream()
                .map(TestResultEntity::getLastModifiedAt)
                .filter(value -> value != null)
                .max(Comparator.naturalOrder())
                .orElse(results.stream()
                        .map(TestResultEntity::getCreatedAt)
                        .filter(value -> value != null)
                        .max(Comparator.naturalOrder())
                        .orElse(null));

        return BulkVerificationBatchResponse.builder()
                .batchId(testId.toString())
                .batchName(catalog == null ? "Unknown Test Group" : catalog.getTestName())
                .batchCode(catalog == null ? testId.toString() : catalog.getTestCode())
                .department(catalog == null ? "Unknown Department" : catalog.getCategory())
                .totalResults(results.size())
                .safeForApproval(safeResults.size())
                .exceptions(results.size() - safeResults.size())
                .updatedAt(updatedAt)
                .resultIds(safeResults.stream()
                        .map(result -> result.getId().toString())
                        .toList())
                .reviewResultIds(reviewResults.stream()
                        .map(result -> result.getId().toString())
                        .toList())
                .build();
    }

    private boolean isSafeForBulkApproval(TestResultEntity result) {
        return result.getStatus() == ResultStatus.ENTERED
                && (result.getFlag() == null || result.getFlag() == ResultFlag.NORMAL);
    }

    private int flagSeverity(ResultFlag flag) {
        return switch (flag) {
            case NORMAL -> 0;
            case LOW, HIGH -> 1;
            case CRITICAL_LOW, CRITICAL_HIGH -> 2;
        };
    }

    private ResultFlag resolveOverallFlag(List<TestResultEntity> results) {
        return results.stream()
                .map(TestResultEntity::getFlag)
                .filter(Objects::nonNull)
                .max(Comparator.comparingInt(this::flagSeverity))
                .orElse(null);
    }

    private boolean hasCriticalFinding(List<TestResultEntity> results) {
        return results.stream()
                .anyMatch(result -> result.getFlag() == ResultFlag.CRITICAL_HIGH
                        || result.getFlag() == ResultFlag.CRITICAL_LOW);
    }

    private VerificationHistoryItemResponse toHistoryItemResponse(AuditLog auditLog) {
        Map<String, String> details = parseDetails(auditLog.getDetails());
        return VerificationHistoryItemResponse.builder()
                .resultId(auditLog.getEntityId() == null ? "" : auditLog.getEntityId().toString())
                .actionType(auditLog.getAction())
                .testName(details.getOrDefault("testName", "Unknown Test Group"))
                .specimenPriority(details.get("specimenPriority"))
                .actionSummary(getActionSummary(auditLog.getAction()))
                .performedBy(auditLog.getPerformedBy())
                .actionAt(auditLog.getTimestamp() == null ? null : auditLog.getTimestamp().atZone(java.time.ZoneId.systemDefault()).toInstant())
                .notes(details.get("notes"))
                .updatedAt(auditLog.getTimestamp() == null ? null : auditLog.getTimestamp().atZone(java.time.ZoneId.systemDefault()).toInstant())
                .build();
    }

    private String getActionSummary(String action) {
        if (ACTION_VERIFICATION_APPROVED.equals(action)) {
            return "Approved by Supervisor";
        }
        if (ACTION_RETURNED_TO_MLT.equals(action)) {
            return "Returned to MLT";
        }
        if (ACTION_RETURNED_FROM_CLINICAL.equals(action)) {
            return "Returned to Supervisor from Clinical";
        }
        return "Workflow Updated";
    }

    private String resolvePatientName(String patientId) {
        return resolvePatientEntity(patientId)
                .map(PatientEntity::getFullName)
                .orElse(null);
    }

    private java.util.Optional<PatientEntity> resolvePatientEntity(String patientId) {
        if (patientId == null || patientId.isBlank()) {
            return java.util.Optional.empty();
        }

        String normalizedPatientId = patientId.trim();

        return patientRepository.findByPatientCode(normalizedPatientId)
                .or(() -> resolvePatientByUuid(normalizedPatientId));
    }

    private String safelyResolvePatientName(String patientId) {
        try {
            return resolvePatientName(patientId);
        } catch (Exception exception) {
            return null;
        }
    }

    private PatientEntity safelyResolvePatientEntity(String patientId) {
        try {
            return resolvePatientEntity(patientId).orElse(null);
        } catch (Exception exception) {
            return null;
        }
    }

    private UUID safelyResolveTestId(TestResultEntity result) {
        try {
            return result.getSample().getOrderItem().getTestId();
        } catch (Exception exception) {
            return null;
        }
    }

    private String safelyResolvePatientId(TestResultEntity result) {
        try {
            return result.getSample().getOrderItem().getOrder().getPatientId();
        } catch (Exception exception) {
            return null;
        }
    }

    private java.util.Optional<PatientEntity> resolvePatientByUuid(String patientId) {
        try {
            return patientRepository.findById(UUID.fromString(patientId));
        } catch (IllegalArgumentException exception) {
            return java.util.Optional.empty();
        }
    }

    private Integer calculatePatientAge(PatientEntity patient) {
        if (patient.getDob() == null) {
            return null;
        }

        return Period.between(patient.getDob(), LocalDate.now()).getYears();
    }

    private List<PreviousVisitSummaryResponse> resolvePreviousVisits(String patientId, UUID testId, UUID currentSampleId) {
        if (patientId == null || patientId.isBlank() || testId == null || currentSampleId == null) {
            return List.of();
        }

        TestResultEntity currentResult = testResultRepository.findBySampleId(currentSampleId).stream()
                .findFirst()
                .orElse(null);
        Instant currentVisitAt = currentResult == null
                ? null
                : currentResult.getSample().getCollectedAt() != null
                ? currentResult.getSample().getCollectedAt()
                : currentResult.getSample().getCreatedAt();

        if (currentVisitAt == null) {
            return List.of();
        }

        Map<UUID, List<TestResultEntity>> resultsBySample = testResultRepository
                .findPreviousResultsForPatientAndTest(patientId.trim(), testId, currentSampleId, currentVisitAt)
                .stream()
                .collect(Collectors.groupingBy(
                        result -> result.getSample().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        return resultsBySample.values().stream()
                .map(this::toPreviousVisitSummary)
                .limit(5)
                .toList();
    }

    private PreviousVisitSummaryResponse toPreviousVisitSummary(List<TestResultEntity> sampleResults) {
        TestResultEntity primaryResult = sampleResults.get(0);
        Instant visitedAt = primaryResult.getSample().getCollectedAt() != null
                ? primaryResult.getSample().getCollectedAt()
                : primaryResult.getSample().getCreatedAt();
        int abnormalCount = (int) sampleResults.stream()
                .filter(result -> result.getFlag() != null && result.getFlag() != ResultFlag.NORMAL)
                .count();
        int criticalCount = (int) sampleResults.stream()
                .filter(result -> result.getFlag() == ResultFlag.CRITICAL_HIGH || result.getFlag() == ResultFlag.CRITICAL_LOW)
                .count();

        return PreviousVisitSummaryResponse.builder()
                .resultId(primaryResult.getId().toString())
                .sampleId(primaryResult.getSample().getId().toString())
                .status(primaryResult.getStatus() == null ? null : primaryResult.getStatus().name())
                .priorityLevel(primaryResult.getSample().getPriority() == null
                        ? null
                        : primaryResult.getSample().getPriority().name())
                .visitedAt(visitedAt)
                .parameterCount(sampleResults.size())
                .abnormalCount(abnormalCount)
                .criticalCount(criticalCount)
                .build();
    }

    private String resolveHistoryNotes(String action, String notes) {
        if (notes != null && !notes.isBlank()) {
            return notes;
        }
        if (ACTION_VERIFICATION_APPROVED.equals(action)) {
            return "Technically verified by lab supervisor.";
        }
        if (ACTION_RETURNED_TO_MLT.equals(action)) {
            return "Returned to MLT for correction and re-entry.";
        }
        return notes;
    }

    private String resolveApprovalHistoryNotes(String supervisorNote) {
        if (supervisorNote != null && !supervisorNote.isBlank()) {
            return sanitizeHistoryNote(supervisorNote);
        }

        return resolveHistoryNotes(ACTION_VERIFICATION_APPROVED, null);
    }

    private String composeStoredNotes(String mltNotes, String supervisorNote) {
        String trimmedMltNotes = trimToNull(mltNotes);
        String trimmedSupervisorNote = trimToNull(supervisorNote);

        if (trimmedSupervisorNote == null) {
            return trimmedMltNotes;
        }

        if (trimmedMltNotes == null) {
            return SUPERVISOR_NOTE_MARKER + System.lineSeparator() + trimmedSupervisorNote;
        }

        return MLT_NOTE_MARKER + System.lineSeparator() + trimmedMltNotes
                + System.lineSeparator() + System.lineSeparator()
                + SUPERVISOR_NOTE_MARKER + System.lineSeparator() + trimmedSupervisorNote;
    }

    private String extractMltNote(String storedNotes) {
        if (storedNotes == null || storedNotes.isBlank()) {
            return storedNotes;
        }

        if (!storedNotes.contains(MLT_NOTE_MARKER) && !storedNotes.contains(SUPERVISOR_NOTE_MARKER)) {
            return storedNotes;
        }

        return extractSection(storedNotes, MLT_NOTE_MARKER);
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

        return trimToNull(section);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private String sanitizeHistoryNote(String note) {
        String trimmed = trimToNull(note);
        if (trimmed == null) {
            return null;
        }

        if (trimmed.startsWith("Added by ")) {
            int separatorIndex = trimmed.indexOf(": ");
            if (separatorIndex >= 0 && separatorIndex + 2 < trimmed.length()) {
                return trimmed.substring(separatorIndex + 2).trim();
            }
        }

        if (trimmed.startsWith("Returned by ")) {
            int separatorIndex = trimmed.indexOf(": ");
            if (separatorIndex >= 0 && separatorIndex + 2 < trimmed.length()) {
                return trimmed.substring(separatorIndex + 2).trim();
            }
        }

        return trimmed;
    }

    private void logVerificationEvent(TestResultEntity result, String action, String notes) {
        TestCatalogEntity catalog = testCatalogRepository.findById(result.getSample().getOrderItem().getTestId())
                .orElse(null);

        Map<String, String> details = new HashMap<>();
        details.put("testName", catalog == null ? "Unknown Test Group" : catalog.getTestName());
        if (result.getSample().getPriority() != null) {
            details.put("specimenPriority", result.getSample().getPriority().name());
        }
        if (notes != null && !notes.isBlank()) {
            details.put("notes", notes);
        }

        try {
            auditService.log(
                    action,
                    VERIFICATION_ENTITY_TYPE,
                    result.getId(),
                    result.getSample().getBarcode(),
                    objectMapper.writeValueAsString(details),
                    null
            );
        } catch (Exception exception) {
            throw new RuntimeException("Failed to log verification history event", exception);
        }
    }

    private Map<String, String> parseDetails(String rawDetails) {
        if (rawDetails == null || rawDetails.isBlank()) {
            return Map.of();
        }

        try {
            return objectMapper.readValue(rawDetails, new TypeReference<>() {
            });
        } catch (Exception exception) {
            return Map.of("notes", rawDetails);
        }
    }
}
