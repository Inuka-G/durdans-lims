package com.uom.lims.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.verification.dto.request.BulkVerificationRequest;
import com.uom.lims.api.verification.dto.request.VerificationRequest;
import com.uom.lims.api.verification.dto.response.BulkVerificationBatchResponse;
import com.uom.lims.api.verification.dto.response.BulkVerificationCaseResponse;
import com.uom.lims.api.verification.dto.response.BulkVerificationParameterPreviewResponse;
import com.uom.lims.api.verification.dto.response.PreviousVisitSummaryResponse;
import com.uom.lims.api.verification.dto.response.TestResultDetailResponse;
import com.uom.lims.api.verification.dto.response.TestResultSummaryResponse;
import com.uom.lims.api.verification.dto.response.VerificationHistoryItemResponse;
import com.uom.lims.audit.AuditLog;
import com.uom.lims.audit.AuditLogRepository;
import com.uom.lims.audit.AuditService;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.exception.BusinessRuleException;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.mapper.TestResultMapper;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.repository.SampleRepository;
import com.uom.lims.repository.TestCatalogRepository;
import com.uom.lims.repository.TestResultRepository;
import com.uom.lims.qc.QcGateService;
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
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@lombok.extern.slf4j.Slf4j
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
    private static final String ACTION_QC_OVERRIDE_RELEASE = "QC_OVERRIDE_RELEASE";
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
    private final QcGateService qcGateService;
    private final CaseContextResolver caseContextResolver;

    /** Result statuses the supervisor can act on; anything else is released or with the MLT. */
    private static final List<ResultStatus> AWAITING_SUPERVISOR = List.of(
            ResultStatus.ENTERED,
            ResultStatus.RETURNED_FOR_RECHECK,
            ResultStatus.RETURNED_TO_MLT);

    private static final List<ResultStatus> RETURNED_STATUSES = List.of(
            ResultStatus.RETURNED_FOR_RECHECK,
            ResultStatus.RETURNED_TO_MLT);

    /** How many parameters a bulk-approval card previews before "+n more". */
    private static final int BULK_CARD_PARAMETER_PREVIEW = 4;

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
                .filter(tr -> isAwaitingSupervisor(tr.getStatus()))
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
                    patientNamesById.getOrDefault(patientId, "UNKNOWN_PATIENT"),
                    patientId);
            List<TestResultEntity> submittedResults = testResultRepository.findBySampleId(sample.getId()).stream()
                    .filter(tr -> !tr.isDeleted())
                    .filter(tr -> !Boolean.TRUE.equals(tr.getDraft()))
                    .toList();
            ResultFlag overallFlag = resolveOverallFlag(submittedResults);
            boolean criticalFinding = hasCriticalFinding(submittedResults);
            return TestResultSummaryResponse.builder()
                    .resultId(base.getResultId())
                    .status(base.getStatus())
                    .patientCode(base.getPatientCode())
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

        TestResultSummaryResponse base =
                testResultMapper.toSummaryResponse(primary, testName, patientName, patientId);
        return TestResultSummaryResponse.builder()
                .resultId(base.getResultId())
                .status(aggregateStatus)
                .patientCode(base.getPatientCode())
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
                RETURNED_STATUSES,
                SampleStatus.SENT_FOR_VERIFICATION);

        Map<UUID, TestCatalogEntity> catalogsById = testCatalogRepository.findAllByIdInAndActiveTrueAndDeletedFalse(
                        pendingResults.stream()
                                .map(result -> result.getSample().getOrderItem().getTestId())
                                .distinct()
                                .toList()
                ).stream()
                .collect(Collectors.toMap(TestCatalogEntity::getId, catalog -> catalog));

        // Cards show who the case belongs to; one lookup for the whole worklist.
        List<String> patientCodes = pendingResults.stream()
                .map(VerificationService::patientCodeOf)
                .filter(code -> code != null && !code.isBlank())
                .distinct()
                .toList();
        Map<String, String> patientNamesByCode = patientCodes.isEmpty()
                ? Map.of()
                : patientRepository.findByPatientCodeIn(new java.util.HashSet<>(patientCodes)).stream()
                .collect(Collectors.toMap(
                        PatientEntity::getPatientCode,
                        PatientEntity::getFullName,
                        (first, second) -> first));

        return pendingResults.stream()
                .collect(Collectors.groupingBy(result -> result.getSample().getOrderItem().getTestId()))
                .entrySet().stream()
                .map(entry -> toBulkBatchResponse(
                        entry.getKey(), entry.getValue(), catalogsById.get(entry.getKey()), patientNamesByCode))
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
            String search,
            java.time.LocalDateTime fromTimestamp
    ) {
        List<String> actions = resolveHistoryActions(actionType, VERIFICATION_HISTORY_ACTIONS);
        if (actions.isEmpty()) {
            return Page.empty(PageRequest.of(page, size));
        }

        Page<AuditLog> auditPage = auditLogRepository
                .findHistoryByEntityTypeAndActions(
                        VERIFICATION_ENTITY_TYPE,
                        actions,
                        CaseContextResolver.normalizeHistorySearch(search),
                        fromTimestamp,
                        PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"))
                );

        Map<UUID, HistoryCaseRef> cases = resolveHistoryCases(auditPage.getContent());
        return auditPage.map(auditLog -> toHistoryItemResponse(auditLog, cases));
    }

    /** Patient identity and case number for one audited action, resolved for the history table. */
    private record HistoryCaseRef(String patientCode, String patientName, String resultNo) {
    }

    /**
     * Resolve the patient and case number behind each audit row for a whole page
     * at once.
     *
     * <p>The audit row itself cannot be trusted for this: the verification writes
     * put the specimen barcode in the patient_code column, so the identity has to
     * come from the result the row points at — result -> sample -> order -> patient.
     *
     * <p>Batched deliberately. Resolving per row turned a 25-row page into 50
     * queries; this is two regardless of page size.
     */
    private Map<UUID, HistoryCaseRef> resolveHistoryCases(List<AuditLog> auditLogs) {
        List<UUID> resultIds = auditLogs.stream()
                .map(AuditLog::getEntityId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (resultIds.isEmpty()) {
            return Map.of();
        }

        Map<UUID, String> codeByResultId = new HashMap<>();
        Map<UUID, String> resultNoByResultId = new HashMap<>();
        for (TestResultEntity result : testResultRepository.findAllById(resultIds)) {
            String code = patientCodeOf(result);
            if (code != null && !code.isBlank()) {
                codeByResultId.put(result.getId(), code.trim());
            }
            if (result.getSample() != null && result.getSample().getResultNo() != null) {
                resultNoByResultId.put(result.getId(), result.getSample().getResultNo());
            }
        }

        Map<String, String> nameByCode = codeByResultId.isEmpty()
                ? Map.of()
                : patientRepository
                .findByPatientCodeIn(new java.util.HashSet<>(codeByResultId.values()))
                .stream()
                .collect(Collectors.toMap(
                        PatientEntity::getPatientCode,
                        PatientEntity::getFullName,
                        (first, second) -> first));

        Map<UUID, HistoryCaseRef> resolved = new HashMap<>();
        for (UUID resultId : resultIds) {
            String code = codeByResultId.get(resultId);
            String resultNo = resultNoByResultId.get(resultId);
            if (code == null && resultNo == null) {
                continue;
            }
            resolved.put(resultId, new HistoryCaseRef(code, code == null ? null : nameByCode.get(code), resultNo));
        }
        return resolved;
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

        // One query serves both the "previous visits" panel and the per-parameter
        // delta column, so the two can never disagree about what "previous" means.
        List<TestResultEntity> priorResults = caseContextResolver.priorResults(patientId, testId, result.getSample());
        List<PreviousVisitSummaryResponse> previousVisits = toPreviousVisits(priorResults);
        Map<UUID, TestResultEntity> priorByParameter = caseContextResolver.latestReleasedByParameter(priorResults);

        return testResultMapper.toDetailResponse(
                result,
                caseResults,
                patientId,
                patientName,
                testType,
                patientAge,
                patientGender,
                previousVisits,
                priorByParameter,
                caseContextResolver.receivedAt(result.getSample().getId())
        );
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public TestResultDetailResponse verifyResult(UUID resultId, VerificationRequest request) {
        TestResultEntity anchor = findResultById(resultId);

        if (!isAwaitingSupervisor(anchor.getStatus())) {
            throw new IllegalStateException(
                    "Cannot verify result not in ENTERED, RETURNED_FOR_RECHECK or RETURNED_TO_MLT status. Current: "
                            + anchor.getStatus());
        }
        assertNotWithMlt(anchor);

        String username = SecurityUtils.getCurrentUsername();
        String actorName = currentActorName();
        Instant now = Instant.now();
        String storedNotes = composeStoredNotes(request.getMltNotes(), request.getSupervisorNote());
        String historyNotes = resolveApprovalHistoryNotes(request.getSupervisorNote());

        List<TestResultEntity> targets = testResultRepository.findBySampleId(anchor.getSample().getId()).stream()
                .filter(tr -> !tr.isDeleted())
                .filter(tr -> !Boolean.TRUE.equals(tr.getDraft()))
                .filter(tr -> isAwaitingSupervisor(tr.getStatus()))
                .toList();

        if (targets.isEmpty()) {
            throw new IllegalStateException("No pending parameter results to verify for this sample.");
        }

        // ---- QC release gate -------------------------------------------------
        //
        // This is where a result actually becomes releasable, so this is where the
        // control has to hold. Every path that releases arrives here: single verify,
        // bulkVerify (which calls verifyResult through the proxy), and re-release
        // after an amendment, which resets the result to ENTERED.
        //
        // The verdict is re-evaluated rather than trusted from ingestion: a control
        // recorded in between may have cleared the hold, and one recorded late may
        // have created it.
        applyQcGate(targets, request);

        SampleEntity sample = anchor.getSample();
        sample.setStatus(SampleStatus.VERIFIED);

        for (TestResultEntity result : targets) {
            result.setStatus(ResultStatus.TECHNICALLY_VERIFIED);
            result.setMltNotes(storedNotes);
            result.setTechnicallyVerifiedBy(actorName);
            result.setTechnicallyVerifiedAt(now);
            result.setLastModifiedBy(username);
            result.setLastModifiedAt(now);
            testResultRepository.save(result);
        }

        logVerificationEvent(anchor, ACTION_VERIFICATION_APPROVED, historyNotes);
        return getResultDetails(resultId);
    }

    /**
     * Return the case to the MLT for re-run / re-entry.
     *
     * <p>The reason travels in {@code supervisorNote} and is stamped on the result
     * as a return (reason / by / at) so the MLT, the pending queue and the audit
     * trail all show the same thing. The MLT's own notes are preserved alongside it
     * — an earlier version overwrote them with the return reason, which lost the
     * bench's account of the run at the exact moment it mattered most.
     */
    @Transactional
    public TestResultDetailResponse rejectResult(UUID resultId, VerificationRequest request) {
        TestResultEntity anchor = findResultById(resultId);

        if (!isAwaitingSupervisor(anchor.getStatus())) {
            throw new IllegalStateException(
                    "Cannot return result not in ENTERED, RETURNED_FOR_RECHECK or RETURNED_TO_MLT status. Current: "
                            + anchor.getStatus());
        }
        assertNotWithMlt(anchor);

        // Older clients sent the reason as mltNotes ("Returned by X: reason"); the
        // supervisor note is the field the reason belongs in.
        String returnReason = trimToNull(request.getSupervisorNote());
        if (returnReason == null) {
            returnReason = sanitizeHistoryNote(request.getMltNotes());
        }
        if (returnReason == null) {
            throw new BusinessRuleException("A return reason is required to send a case back to the MLT.");
        }

        String username = SecurityUtils.getCurrentUsername();
        String actorName = currentActorName();
        Instant now = Instant.now();

        List<TestResultEntity> targets = testResultRepository.findBySampleId(anchor.getSample().getId()).stream()
                .filter(tr -> !tr.isDeleted())
                .filter(tr -> !Boolean.TRUE.equals(tr.getDraft()))
                .filter(tr -> isAwaitingSupervisor(tr.getStatus()))
                .toList();

        if (targets.isEmpty()) {
            throw new IllegalStateException("No pending parameter results to return to MLT for this sample.");
        }

        SampleEntity sample = anchor.getSample();
        sample.setStatus(SampleStatus.IN_TESTING);

        for (TestResultEntity result : targets) {
            result.setStatus(ResultStatus.RETURNED_TO_MLT);
            // Keep the MLT's note; file the supervisor's reason in its own section.
            String existingMltNote = extractMltNote(result.getMltNotes());
            result.setMltNotes(composeStoredNotes(existingMltNote, returnReason));
            result.setReturnReason(returnReason);
            result.setReturnedBy(actorName);
            result.setReturnedAt(now);
            // Do NOT stamp technicallyVerifiedBy/At on a return — the result was
            // returned, not verified. lastModified captures who/when.
            result.setLastModifiedBy(username);
            result.setLastModifiedAt(now);
            testResultRepository.save(result);
        }

        logVerificationEvent(anchor, ACTION_RETURNED_TO_MLT, returnReason);
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
                        // The remark the supervisor typed in the batch confirmation
                        // modal; without this every bulk approval landed on the
                        // audit trail with no reason attached.
                        .supervisorNote(request.getSupervisorNote())
                        .build();

                self.verifyResult(resultId, verificationRequest);
                resultMap.put(resultIdValue, "VERIFIED");
            } catch (Exception exception) {
                resultMap.put(resultIdValue, "FAILED: " + exception.getMessage());
            }
        }

        return resultMap;
    }

    /** Roles permitted to release results over a QC failure. */
    private static final List<String> QC_OVERRIDE_ROLES =
            List.of("LAB_SUPERVISOR", "BRANCH_ADMIN", "SUPER_ADMIN");

    private static final int MIN_OVERRIDE_REASON = 20;

    /**
     * Hold the release when the governing QC did not pass, unless a supervisor
     * explicitly releases over it with a documented reason.
     *
     * <p>The QC status recorded on each result is refreshed here and then frozen —
     * it is the verdict as at release, which is what an assessor asks for. An
     * override never rewrites it to PASS: the result continues to read FAIL
     * everywhere, alongside who waived it and why.
     */
    private void applyQcGate(List<TestResultEntity> targets, VerificationRequest request) {
        List<TestResultEntity> blocked = new ArrayList<>();

        for (TestResultEntity target : targets) {
            String loinc = target.getParameter() == null ? null : target.getParameter().getLoincCode();
            QcGateService.QcVerdict verdict =
                    qcGateService.evaluate(target.getInstrumentCode(), loinc, target.getMeasuredAt());
            target.setQcStatus(verdict.state().name());
            target.setQcResultId(verdict.governingQcId());

            // An override already applied to this result (e.g. a previous partial
            // release of the same specimen) is not demanded again.
            if (verdict.holds() && target.getQcOverrideBy() == null) {
                blocked.add(target);
            }
        }

        if (blocked.isEmpty()) {
            return;
        }

        String summary = blocked.stream()
                .map(t -> (t.getParameter() == null ? "result" : t.getParameter().getName())
                        + ": " + t.getQcStatus())
                .collect(Collectors.joining(", "));

        // An MLT cannot waive the control they ran. Segregation of duties is the
        // point of the override, not an inconvenience in it.
        boolean authorised = QC_OVERRIDE_ROLES.stream().anyMatch(SecurityUtils::hasRole);
        if (!authorised) {
            throw new BusinessRuleException(
                    "QC hold — " + summary + ". A lab supervisor must release over QC.");
        }

        String reason = request == null ? null : request.getQcOverrideReason();
        if (reason == null || reason.trim().length() < MIN_OVERRIDE_REASON) {
            throw new BusinessRuleException(
                    "QC hold — " + summary + ". Releasing over QC requires a documented reason of at least "
                            + MIN_OVERRIDE_REASON + " characters.");
        }

        String username = SecurityUtils.getCurrentUsername();
        Instant now = Instant.now();
        for (TestResultEntity target : blocked) {
            target.setQcOverrideBy(username);
            target.setQcOverrideAt(now);
            target.setQcOverrideReason(reason.trim());

            auditService.log(ACTION_QC_OVERRIDE_RELEASE, VERIFICATION_ENTITY_TYPE, target.getId(),
                    patientCodeOf(target), qcOverridePayload(target, reason.trim()), null);
        }
        log.warn("QC override by {}: released {} result(s) over QC — {}", username, blocked.size(), summary);
    }

    /**
     * Human-facing actor for the fields a report shows: the token's display name
     * when it carries one, else the login id. A verified-by line reading
     * "Dr N. Perera" is what a clinician can act on; "nperera" is not.
     */
    private static String currentActorName() {
        String displayName = SecurityUtils.getCurrentDisplayName();
        if (displayName != null && !displayName.isBlank()) {
            return displayName;
        }
        return SecurityUtils.getCurrentUsername();
    }

    private static String patientCodeOf(TestResultEntity result) {
        SampleEntity sample = result.getSample();
        if (sample == null || sample.getOrderItem() == null || sample.getOrderItem().getOrder() == null) {
            return null;
        }
        return sample.getOrderItem().getOrder().getPatientId();
    }

    private String qcOverridePayload(TestResultEntity result, String reason) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("instrumentCode", result.getInstrumentCode());
        payload.put("loincCode", result.getParameter() == null ? null : result.getParameter().getLoincCode());
        payload.put("qcStatus", result.getQcStatus());
        payload.put("governingQcId", result.getQcResultId() == null ? null : result.getQcResultId().toString());
        payload.put("measuredAt", result.getMeasuredAt() == null ? null : result.getMeasuredAt().toString());
        payload.put("reason", reason);
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            return "{\"reason\":\"" + reason.replace('"', '\'') + "\"}";
        }
    }

    /**
     * Single loader for every result this service touches — getResultDetails,
     * verifyResult, rejectResult, and bulkVerify via verifyResult. The tenant
     * guard lives here rather than at each call site so a future entry point
     * cannot forget it.
     *
     * <p>A result has no branch of its own; it inherits the branch of the order
     * that requested the specimen.
     */
    private TestResultEntity findResultById(UUID id) {
        TestResultEntity result = testResultRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Test result not found: " + id));
        SecurityUtils.assertCanAccessBranch(branchOf(result), "Test result", id);
        return result;
    }

    private static String branchOf(TestResultEntity result) {
        SampleEntity sample = result.getSample();
        if (sample == null || sample.getOrderItem() == null || sample.getOrderItem().getOrder() == null) {
            return null; // unreachable for anyone but SUPER_ADMIN — fail closed
        }
        return sample.getOrderItem().getOrder().getBranchCode();
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
            TestCatalogEntity catalog,
            Map<String, String> patientNamesByCode
    ) {
        // Bulk approval operates on cases (one specimen), not on individual analyte
        // rows. Approving an anchor verifies every pending parameter on its sample,
        // so counting parameters both overstated the queue and let a case count as
        // safe on the strength of one normal analyte while another was critical.
        Map<UUID, List<TestResultEntity>> resultsBySample = results.stream()
                .filter(result -> result.getSample() != null)
                .collect(Collectors.groupingBy(
                        result -> result.getSample().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()));

        List<String> safeCaseIds = new ArrayList<>();
        List<String> reviewCaseIds = new ArrayList<>();
        List<BulkVerificationCaseResponse> cases = new ArrayList<>();
        resultsBySample.forEach((sampleId, caseResults) -> {
            String anchorResultId = resolveCaseAnchorResultId(caseResults);
            if (anchorResultId == null) {
                return;
            }
            boolean safe = isCaseSafeForBulkApproval(caseResults);
            if (safe) {
                safeCaseIds.add(anchorResultId);
            } else {
                reviewCaseIds.add(anchorResultId);
            }
            cases.add(toBulkCaseResponse(anchorResultId, caseResults, safe, patientNamesByCode));
        });
        int totalCases = safeCaseIds.size() + reviewCaseIds.size();

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
                .totalResults(totalCases)
                .safeForApproval(safeCaseIds.size())
                .exceptions(reviewCaseIds.size())
                .updatedAt(updatedAt)
                .resultIds(safeCaseIds)
                .reviewResultIds(reviewCaseIds)
                .cases(cases)
                .build();
    }

    /** One card's worth of a case: who, how urgent, what the first few values look like. */
    private BulkVerificationCaseResponse toBulkCaseResponse(
            String anchorResultId,
            List<TestResultEntity> caseResults,
            boolean safe,
            Map<String, String> patientNamesByCode
    ) {
        TestResultEntity first = caseResults.get(0);
        SampleEntity sample = first.getSample();
        String patientCode = patientCodeOf(first);

        List<TestResultEntity> ordered = caseResults.stream()
                .sorted(Comparator
                        .comparing(
                                (TestResultEntity tr) -> tr.getParameter() == null
                                        ? null
                                        : tr.getParameter().getDisplayOrder(),
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(
                                tr -> tr.getParameter() == null ? "" : tr.getParameter().getName(),
                                String.CASE_INSENSITIVE_ORDER))
                .toList();

        List<BulkVerificationParameterPreviewResponse> previews = ordered.stream()
                .limit(BULK_CARD_PARAMETER_PREVIEW)
                .map(tr -> BulkVerificationParameterPreviewResponse.builder()
                        .parameterName(tr.getParameter() == null ? null : tr.getParameter().getName())
                        .resultValue(tr.getResultValue())
                        .unit(tr.getParameter() == null ? null : tr.getParameter().getUnit())
                        .flag(tr.getFlag() == null ? null : tr.getFlag().name())
                        .build())
                .toList();

        Instant updatedAt = caseResults.stream()
                .map(TestResultEntity::getLastModifiedAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(sample == null ? null : sample.getLastModifiedAt());

        ResultFlag overallFlag = resolveOverallFlag(caseResults);
        String aggregateStatus = caseResults.stream()
                .anyMatch(tr -> tr.getStatus() == ResultStatus.RETURNED_FOR_RECHECK)
                ? ResultStatus.RETURNED_FOR_RECHECK.name()
                : ResultStatus.ENTERED.name();

        return BulkVerificationCaseResponse.builder()
                .resultId(anchorResultId)
                .resultNo(sample == null ? null : sample.getResultNo())
                .sampleId(sample == null ? null : sample.getId().toString())
                .sampleBarcode(sample == null ? null : sample.getBarcode())
                .patientCode(patientCode)
                .patientName(patientCode == null ? null : patientNamesByCode.get(patientCode))
                .priorityLevel(sample == null || sample.getPriority() == null ? null : sample.getPriority().name())
                .status(aggregateStatus)
                .flag(overallFlag == null ? null : overallFlag.name())
                .hasCriticalFinding(hasCriticalFinding(caseResults))
                .safeForApproval(safe)
                .updatedAt(updatedAt)
                .parameterCount(caseResults.size())
                .parameters(previews)
                .build();
    }

    /** A case is safe only when every parameter on the specimen is safe. */
    private boolean isCaseSafeForBulkApproval(List<TestResultEntity> caseResults) {
        return !caseResults.isEmpty() && caseResults.stream().allMatch(this::isSafeForBulkApproval);
    }

    /**
     * The parameter a case is approved through. Ordered by the panel's own display
     * order so the anchor is stable across calls — the same case must not present a
     * different result id each time the worklist is refreshed.
     */
    private String resolveCaseAnchorResultId(List<TestResultEntity> caseResults) {
        return caseResults.stream()
                .min(Comparator
                        .comparing(
                                (TestResultEntity tr) -> tr.getParameter() == null
                                        ? null
                                        : tr.getParameter().getDisplayOrder(),
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(
                                tr -> tr.getParameter() == null ? "" : tr.getParameter().getName(),
                                String.CASE_INSENSITIVE_ORDER))
                .map(result -> result.getId().toString())
                .orElse(null);
    }

    private boolean isSafeForBulkApproval(TestResultEntity result) {
        return result.getStatus() == ResultStatus.ENTERED
                && (result.getFlag() == null || result.getFlag() == ResultFlag.NORMAL);
    }

    private static boolean isAwaitingSupervisor(ResultStatus status) {
        return status != null && AWAITING_SUPERVISOR.contains(status);
    }

    /**
     * A case the supervisor sent back is the MLT's until they resubmit it; acting
     * on it from the supervisor side in the meantime would race the bench.
     */
    private static void assertNotWithMlt(TestResultEntity anchor) {
        SampleEntity sample = anchor.getSample();
        if (anchor.getStatus() == ResultStatus.RETURNED_TO_MLT
                && sample != null
                && sample.getStatus() == SampleStatus.IN_TESTING) {
            throw new IllegalStateException(
                    "This case was returned to the MLT and is awaiting re-entry; it comes back to the queue when they resubmit.");
        }
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

    private VerificationHistoryItemResponse toHistoryItemResponse(
            AuditLog auditLog,
            Map<UUID, HistoryCaseRef> cases) {
        Map<String, String> details = parseDetails(auditLog.getDetails());
        HistoryCaseRef caseRef = auditLog.getEntityId() == null
                ? null
                : cases.get(auditLog.getEntityId());
        // AuditService writes LocalDateTime.now(UTC); read it back the same way so a
        // host in another zone does not shift every history time by its offset.
        Instant actionAt = auditLog.getTimestamp() == null
                ? null
                : auditLog.getTimestamp().atOffset(ZoneOffset.UTC).toInstant();
        return VerificationHistoryItemResponse.builder()
                .resultId(auditLog.getEntityId() == null ? "" : auditLog.getEntityId().toString())
                .resultNo(caseRef != null && caseRef.resultNo() != null
                        ? caseRef.resultNo()
                        : details.get("resultNo"))
                .actionType(auditLog.getAction())
                .patientCode(caseRef == null ? details.get("patientCode") : caseRef.patientCode())
                .patientName(caseRef == null ? details.get("patientName") : caseRef.patientName())
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

    /** Prior results (newest visit first) grouped into the last five visits. */
    private List<PreviousVisitSummaryResponse> toPreviousVisits(List<TestResultEntity> priorResults) {
        Map<UUID, List<TestResultEntity>> resultsBySample = priorResults.stream()
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
        Instant visitedAt = CaseContextResolver.visitedAt(primaryResult.getSample());
        int abnormalCount = (int) sampleResults.stream()
                .filter(result -> result.getFlag() != null && result.getFlag() != ResultFlag.NORMAL)
                .count();
        int criticalCount = (int) sampleResults.stream()
                .filter(result -> result.getFlag() == ResultFlag.CRITICAL_HIGH || result.getFlag() == ResultFlag.CRITICAL_LOW)
                .count();

        return PreviousVisitSummaryResponse.builder()
                .resultId(primaryResult.getId().toString())
                .resultNo(primaryResult.getSample().getResultNo())
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

        // Everything the history screen shows and searches on is written into the
        // row itself, so the audit trail stays readable even if the result it points
        // at is later purged, and so the all-fields search has something to match.
        Map<String, String> details = new HashMap<>();
        details.put("testName", catalog == null ? "Unknown Test Group" : catalog.getTestName());
        details.put("actionSummary", getActionSummary(action));
        if (result.getSample().getPriority() != null) {
            details.put("specimenPriority", result.getSample().getPriority().name());
        }
        if (result.getSample().getResultNo() != null) {
            details.put("resultNo", result.getSample().getResultNo());
        }
        String patientCode = patientCodeOf(result);
        if (patientCode != null && !patientCode.isBlank()) {
            details.put("patientCode", patientCode);
            String patientName = safelyResolvePatientName(patientCode);
            if (patientName != null && !patientName.isBlank()) {
                details.put("patientName", patientName);
            }
        }
        String performedById = SecurityUtils.getCurrentUserId();
        if (performedById != null && !performedById.isBlank()) {
            details.put("performedById", performedById);
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
