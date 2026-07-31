package com.uom.lims.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.api.clinical.dto.request.ClinicalAuthRequest;
import com.uom.lims.api.clinical.dto.request.ReturnToMLTRequest;
import com.uom.lims.api.dispatch.dto.request.RegisterAuthorizedReportRequest;
import com.uom.lims.api.dispatch.enums.DeliveryMethod;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.verification.dto.response.TestResultDetailResponse;
import com.uom.lims.api.verification.dto.response.PreviousVisitSummaryResponse;
import com.uom.lims.api.verification.dto.response.TestResultSummaryResponse;
import com.uom.lims.api.verification.dto.response.VerificationHistoryItemResponse;
import com.uom.lims.audit.AuditLog;
import com.uom.lims.audit.AuditLogRepository;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.audit.AuditService;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.dispatch.DispatchService;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.exception.InvalidRequestException;
import com.uom.lims.exception.InvalidStateTransitionException;
import com.uom.lims.mapper.TestResultMapper;
import com.uom.lims.metadata.BranchRepository;
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

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.Period;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@RequiredArgsConstructor
@Service
public class ClinicalAuthorizationService {
    private static final String ACTION_CLINICAL_AUTHORIZED = "CLINICAL_AUTHORIZED";
    private static final String ACTION_RETURNED_FROM_CLINICAL = "VERIFICATION_RETURNED_FROM_CLINICAL";
    private static final String VERIFICATION_ENTITY_TYPE = "VERIFICATION";
    private static final List<String> CLINICAL_HISTORY_ACTIONS = List.of(
            ACTION_CLINICAL_AUTHORIZED,
            ACTION_RETURNED_FROM_CLINICAL
    );

    private final AuditService auditService;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;
    private final TestResultRepository testResultRepository;
    private final SampleRepository sampleRepository;
    private final TestCatalogRepository testCatalogRepository;
    private final TestResultMapper testResultMapper;
    private final PatientRepository patientRepository;
    private final BranchRepository branchRepository;
    private final DispatchService dispatchService;

    @Transactional(readOnly = true)
    public Page<TestResultSummaryResponse> getPendingResults(int page, int size) {
        Pageable pageable = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Order.desc("lastModifiedAt"), Sort.Order.desc("id")));
        Page<SampleEntity> samplesPage = sampleRepository.findByStatusInAndBranch(
                List.of(SampleStatus.VERIFIED),
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

        return samplesPage.map(sample -> buildClinicalQueueSummary(sample, testNamesById, patientNamesById));
    }

    /** One pathologist worklist row per completed lab verification (specimen), not per parameter. */
    private TestResultSummaryResponse buildClinicalQueueSummary(
            SampleEntity sample,
            Map<UUID, String> testNamesById,
            Map<String, String> patientNamesById) {
        List<TestResultEntity> verifiedParams = testResultRepository.findBySampleId(sample.getId()).stream()
                .filter(tr -> !tr.isDeleted())
                .filter(tr -> !Boolean.TRUE.equals(tr.getDraft()))
                .filter(tr -> tr.getStatus() == ResultStatus.TECHNICALLY_VERIFIED)
                .toList();

        UUID testId = sample.getOrderItem().getTestId();
        String patientId = sample.getOrderItem().getOrder().getPatientId();
        String testName = testNamesById.getOrDefault(testId, "UNKNOWN_TEST");
        String patientName = patientNamesById.getOrDefault(patientId, "UNKNOWN_PATIENT");

        if (verifiedParams.isEmpty()) {
            TestResultEntity fallback = testResultRepository.findBySampleId(sample.getId()).stream()
                    .filter(tr -> !tr.isDeleted())
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException(
                            "No test results for clinically pending sample: " + sample.getId()));
            TestResultSummaryResponse base = testResultMapper.toSummaryResponse(fallback, testName, patientName);
            boolean criticalFinding = testResultRepository.findBySampleId(sample.getId()).stream()
                    .filter(tr -> !tr.isDeleted())
                    .filter(tr -> !Boolean.TRUE.equals(tr.getDraft()))
                    .anyMatch(tr -> tr.getFlag() == ResultFlag.CRITICAL_HIGH || tr.getFlag() == ResultFlag.CRITICAL_LOW);
            return TestResultSummaryResponse.builder()
                    .resultId(base.getResultId())
                    .status(base.getStatus())
                    .patientName(base.getPatientName())
                    .testType(base.getTestType())
                    .mltName(base.getMltName())
                    .qcStatus(base.getQcStatus())
                    .flag(base.getFlag())
                    .priorityLevel(sample.getPriority() == null ? null : sample.getPriority().name())
                    .hasCriticalFinding(criticalFinding)
                    .createdAt(base.getCreatedAt())
                    .updatedAt(sample.getLastModifiedAt() != null ? sample.getLastModifiedAt() : base.getUpdatedAt())
                    .technicianName(base.getTechnicianName())
                    .pathologistName(base.getPathologistName())
                    .returnReason(base.getReturnReason())
                    .build();
        }

        TestResultEntity primary = verifiedParams.stream()
                .min(Comparator
                        .comparing((TestResultEntity tr) -> tr.getParameter().getDisplayOrder(),
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(tr -> tr.getParameter().getName(), String.CASE_INSENSITIVE_ORDER))
                .orElse(verifiedParams.get(0));

        ResultFlag worstFlag = verifiedParams.stream()
                .map(TestResultEntity::getFlag)
                .filter(Objects::nonNull)
                .max(Comparator.comparingInt(this::clinicalFlagSeverity))
                .orElse(null);

        boolean hasCriticalFinding = verifiedParams.stream()
                .anyMatch(tr -> tr.getFlag() == ResultFlag.CRITICAL_HIGH || tr.getFlag() == ResultFlag.CRITICAL_LOW);

        TestResultSummaryResponse base = testResultMapper.toSummaryResponse(primary, testName, patientName);
        return TestResultSummaryResponse.builder()
                .resultId(base.getResultId())
                .status(ResultStatus.TECHNICALLY_VERIFIED.name())
                .patientName(base.getPatientName())
                .testType(base.getTestType())
                .mltName(base.getMltName())
                .qcStatus(base.getQcStatus())
                .flag(worstFlag != null ? worstFlag.name() : base.getFlag())
                .priorityLevel(sample.getPriority() == null ? null : sample.getPriority().name())
                .hasCriticalFinding(hasCriticalFinding)
                .createdAt(base.getCreatedAt())
                .updatedAt(sample.getLastModifiedAt() != null ? sample.getLastModifiedAt() : base.getUpdatedAt())
                .technicianName(base.getTechnicianName())
                .pathologistName(base.getPathologistName())
                .returnReason(base.getReturnReason())
                .build();
    }

    private int clinicalFlagSeverity(ResultFlag flag) {
        return switch (flag) {
            case NORMAL -> 0;
            case LOW, HIGH -> 1;
            case CRITICAL_LOW, CRITICAL_HIGH -> 2;
        };
    }

    @Transactional(readOnly = true)
    public TestResultDetailResponse getResultDetails(UUID resultId) {
        TestResultEntity result = findResultById(resultId);
        return buildDetailResponse(result);
    }

    @Transactional(readOnly = true)
    public Page<VerificationHistoryItemResponse> getClinicalHistory(
            int page,
            int size,
            String actionType,
            String search
    ) {
        List<String> actions = resolveHistoryActions(actionType, CLINICAL_HISTORY_ACTIONS);
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

    @Transactional
    public TestResultDetailResponse authorizeResult(UUID resultId, ClinicalAuthRequest request) {
        TestResultEntity anchor = findResultById(resultId);

        if (!Boolean.TRUE.equals(request.getSignatureConfirmed())) {
            throw new InvalidRequestException("Pathologist signature confirmation is required before authorization.");
        }

        List<TestResultEntity> targets = testResultRepository.findBySampleId(anchor.getSample().getId()).stream()
                .filter(tr -> !tr.isDeleted())
                .filter(tr -> !Boolean.TRUE.equals(tr.getDraft()))
                .filter(tr -> tr.getStatus() == ResultStatus.TECHNICALLY_VERIFIED)
                .toList();

        if (targets.isEmpty()) {
            throw new InvalidStateTransitionException(
                    "No technically verified parameters to authorize for this sample.");
        }

        String username = SecurityUtils.getCurrentUsername();
        Instant now = Instant.now();
        SampleEntity sample = anchor.getSample();
        sample.setStatus(SampleStatus.AUTHORIZED);
        sampleRepository.save(sample);

        String signature = String.format("Electronically authorized by %s on %s", username, now);
        for (TestResultEntity result : targets) {
            result.setStatus(ResultStatus.CLINICALLY_AUTHORIZED);
            result.setClinicalNote(request.getClinicalNote());
            result.setClinicallyAuthorizedBy(username);
            result.setClinicallyAuthorizedAt(now);
            result.setClinicalSignature(signature);
            result.setLastModifiedBy(username);
            result.setLastModifiedAt(now);
            testResultRepository.save(result);
        }

        registerAuthorizedReportForDispatch(anchor);
        logClinicalAuthorized(anchor, request.getClinicalNote());
        return buildDetailResponse(anchor);
    }

    @Transactional
    public TestResultDetailResponse returnToMlt(UUID resultId, ReturnToMLTRequest request) {
        TestResultEntity anchor = findResultById(resultId);

        List<TestResultEntity> targets = testResultRepository.findBySampleId(anchor.getSample().getId()).stream()
                .filter(tr -> !tr.isDeleted())
                .filter(tr -> !Boolean.TRUE.equals(tr.getDraft()))
                .filter(tr -> tr.getStatus() == ResultStatus.TECHNICALLY_VERIFIED)
                .toList();

        if (targets.isEmpty()) {
            throw new InvalidStateTransitionException(
                    "No technically verified parameters to return to the lab for this sample.");
        }

        String username = SecurityUtils.getCurrentUsername();
        Instant now = Instant.now();
        SampleEntity sample = anchor.getSample();
        sample.setStatus(SampleStatus.SENT_FOR_VERIFICATION);
        sampleRepository.save(sample);

        for (TestResultEntity result : targets) {
            result.setStatus(ResultStatus.RETURNED_FOR_RECHECK);
            result.setReturnReason(request.getReturnReason());
            result.setReturnedBy(username);
            result.setReturnedAt(now);
            result.setLastModifiedBy(username);
            result.setLastModifiedAt(now);
            testResultRepository.save(result);
        }

        logReturnedFromClinical(anchor, request.getReturnReason());
        return buildDetailResponse(anchor);
    }

    private TestResultDetailResponse buildDetailResponse(TestResultEntity result) {
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

        PatientEntity patient = resolvePatientEntity(patientId).orElse(null);
        String patientName = patient != null ? patient.getFullName() : null;
        Integer patientAge = patient == null ? null : calculatePatientAge(patient);
        String patientGender = patient == null || patient.getGender() == null ? null : patient.getGender().name();
        List<PreviousVisitSummaryResponse> previousVisits = resolvePreviousVisits(patientId, testId, result.getSample().getId());

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

    private void registerAuthorizedReportForDispatch(TestResultEntity result) {
        String patientId = safelyResolvePatientId(result);
        PatientEntity patient = resolvePatientEntity(patientId).orElse(null);
        String branchCode = resolveDispatchBranchCode(patient);
        if (branchCode == null || branchCode.isBlank()) {
            throw new InvalidRequestException("Could not resolve a branch for dispatch registration.");
        }

        UUID testId = safelyResolveTestId(result);
        String testType = testId == null
                ? "Unknown Test Group"
                : testCatalogRepository.findById(testId)
                .filter(TestCatalogEntity::isActive)
                .filter(catalog -> !catalog.isDeleted())
                .map(TestCatalogEntity::getTestName)
                .orElse("Unknown Test Group");

        RegisterAuthorizedReportRequest request = RegisterAuthorizedReportRequest.builder()
                .reportReference(result.getId().toString())
                .branchCode(branchCode)
                .patientCode(patientId)
                .patientDisplayName(patient != null && patient.getFullName() != null
                        ? patient.getFullName()
                        : "Unknown patient")
                .testPanelLabel(testType)
                .authorizedAt(result.getClinicallyAuthorizedAt() == null
                        ? null
                        : OffsetDateTime.ofInstant(result.getClinicallyAuthorizedAt(), ZoneId.systemDefault()))
                .preferredDeliveryMethods(List.of(
                        DeliveryMethod.SMS,
                        DeliveryMethod.WHATSAPP,
                        DeliveryMethod.EMAIL,
                        DeliveryMethod.POST))
                .build();

        dispatchService.registerAuthorizedReportSystem(request, "clinical-authorization");
    }

    private String resolveDispatchBranchCode(PatientEntity patient) {
        String securityBranch = SecurityUtils.getCurrentBranchId();
        if (securityBranch != null && !securityBranch.isBlank()) {
            return securityBranch;
        }
        if (patient != null && patient.getBranchCode() != null && !patient.getBranchCode().isBlank()) {
            return patient.getBranchCode();
        }
        return branchRepository.findByCode("BR001")
                .map(branch -> branch.getCode())
                .orElseGet(() -> branchRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt")).stream()
                        .findFirst()
                        .map(branch -> branch.getCode())
                        .orElse(null));
    }

    private void logReturnedFromClinical(TestResultEntity result, String notes) {
        logClinicalEvent(result, ACTION_RETURNED_FROM_CLINICAL, notes);
    }

    private void logClinicalAuthorized(TestResultEntity result, String notes) {
        logClinicalEvent(result, ACTION_CLINICAL_AUTHORIZED, notes);
    }

    private void logClinicalEvent(TestResultEntity result, String action, String notes) {
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
            throw new RuntimeException("Failed to log clinical history event", exception);
        }
    }

    private VerificationHistoryItemResponse toHistoryItemResponse(AuditLog auditLog) {
        Map<String, String> details = parseDetails(auditLog.getDetails());
        Instant actionAt = auditLog.getTimestamp() == null
                ? null
                : auditLog.getTimestamp().atZone(ZoneId.systemDefault()).toInstant();

        return VerificationHistoryItemResponse.builder()
                .resultId(auditLog.getEntityId() == null ? "" : auditLog.getEntityId().toString())
                .actionType(auditLog.getAction())
                .testName(details.getOrDefault("testName", "Unknown Test Group"))
                .specimenPriority(details.get("specimenPriority"))
                .actionSummary(getActionSummary(auditLog.getAction()))
                .performedBy(auditLog.getPerformedBy())
                .actionAt(actionAt)
                .notes(details.get("notes"))
                .updatedAt(actionAt)
                .build();
    }

    private String getActionSummary(String action) {
        if (ACTION_CLINICAL_AUTHORIZED.equals(action)) {
            return "Authorized by Pathologist";
        }
        if (ACTION_RETURNED_FROM_CLINICAL.equals(action)) {
            return "Returned to Supervisor";
        }
        return "Workflow Updated";
    }

    private Map<String, String> parseDetails(String rawDetails) {
        if (rawDetails == null || rawDetails.isBlank()) {
            return Map.of();
        }

        try {
            return objectMapper.readValue(
                    rawDetails,
                    objectMapper.getTypeFactory().constructMapType(LinkedHashMap.class, String.class, String.class)
            );
        } catch (Exception exception) {
            return Map.of("notes", rawDetails);
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

    private String safelyResolvePatientName(String patientId) {
        try {
            return resolvePatientName(patientId);
        } catch (Exception exception) {
            return null;
        }
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
                .collect(Collectors.groupingBy(result -> result.getSample().getId()));

        return resultsBySample.values().stream()
                .sorted(Comparator.comparing(this::resolveVisitedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toPreviousVisitSummary)
                .limit(5)
                .toList();
    }

    private PreviousVisitSummaryResponse toPreviousVisitSummary(List<TestResultEntity> sampleResults) {
        TestResultEntity primaryResult = sampleResults.get(0);
        Instant visitedAt = resolveVisitedAt(sampleResults);
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
                .visitedAt(visitedAt)
                .parameterCount(sampleResults.size())
                .abnormalCount(abnormalCount)
                .criticalCount(criticalCount)
                .build();
    }

    private Instant resolveVisitedAt(List<TestResultEntity> sampleResults) {
        TestResultEntity primaryResult = sampleResults.get(0);
        return primaryResult.getSample().getCollectedAt() != null
                ? primaryResult.getSample().getCollectedAt()
                : primaryResult.getSample().getCreatedAt();
    }
}
