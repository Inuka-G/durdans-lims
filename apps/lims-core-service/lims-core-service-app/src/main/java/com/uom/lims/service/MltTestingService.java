package com.uom.lims.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.api.dto.request.ResultItemRequest;
import com.uom.lims.api.dto.request.SampleRejectRequest;
import com.uom.lims.api.dto.response.MltAllWorklistItemResponse;
import com.uom.lims.api.dto.request.SubmitResultsRequest;
import com.uom.lims.api.dto.response.MltResultActivityItemResponse;
import com.uom.lims.api.dto.response.MltWorklistItemResponse;
import com.uom.lims.api.dto.response.PreviousValueResponse;
import com.uom.lims.api.dto.response.ResultParameterResponse;
import com.uom.lims.api.dto.response.SampleResultsResponse;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.audit.AuditLogRepository;
import com.uom.lims.audit.AuditService;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestParameterEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.exception.BusinessRuleException;
import com.uom.lims.repository.TestCatalogRepository;
import com.uom.lims.repository.SampleRepository;
import com.uom.lims.repository.TestParameterRepository;
import com.uom.lims.repository.TestResultRepository;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MltTestingService {

        private static final String MLT_ENTITY_TYPE = "MLT_RESULT_ENTRY";
        private static final String ACTION_DRAFT = "MLT_RESULTS_DRAFT_SAVED";
        private static final String ACTION_SUBMIT = "MLT_RESULTS_SUBMITTED";

        private static final EnumSet<ResultStatus> PREVIOUS_VALUE_STATUSES = EnumSet.of(
                        ResultStatus.CLINICALLY_AUTHORIZED,
                        ResultStatus.TECHNICALLY_VERIFIED,
                        ResultStatus.DISPATCHED);

        private final SampleRepository sampleRepository;
        private final TestParameterRepository parameterRepository;
        private final TestResultRepository resultRepository;
        private final TestCatalogRepository testCatalogRepository;
        private final PatientRepository patientRepository;
        private final com.uom.lims.refrange.ReferenceRangeService referenceRangeService;
        private final AuditService auditService;
        private final AuditLogRepository auditLogRepository;
        private final ObjectMapper objectMapper;
        private final com.uom.lims.notification.CriticalValueNotificationService criticalValueNotificationService;

        @Transactional(readOnly = true)
        public SampleResultsResponse getSampleResults(UUID sampleId) {

                SampleEntity sample = sampleRepository.findById(sampleId)
                                .orElseThrow(() -> new ResourceNotFoundException("Sample not found"));
                assertSampleBranchAccess(sample);

                UUID testId = sample.getOrderItem().getTestId();
                TestCatalogEntity testCatalog = testCatalogRepository.findById(testId)
                                .orElseThrow(() -> new ResourceNotFoundException("Test catalog not found"));

                String patientName = patientRepository
                                .findByPatientCode(sample.getOrderItem().getOrder().getPatientId())
                                .map(PatientEntity::getFullName)
                                .orElse("UNKNOWN_PATIENT");

                List<TestParameterEntity> parameters = parameterRepository.findByTestIdOrderByDisplayOrderAsc(testId);
                Map<UUID, TestResultEntity> resultsByParameterId = resultRepository.findBySampleId(sample.getId()).stream()
                                .collect(Collectors.toMap(
                                                result -> result.getParameter().getId(),
                                                Function.identity(),
                                                (existing, replacement) -> replacement));

                String patientCode = sample.getOrderItem().getOrder().getPatientId();
                Instant visitAt = sample.getCollectedAt() != null ? sample.getCollectedAt()
                                : sample.getCreatedAt();
                Map<UUID, TestResultEntity> previousByParameterId = resolvePreviousAuthorizedResults(
                                patientCode,
                                sample.getOrderItem().getTestId(),
                                sample.getId(),
                                visitAt);

                List<ResultParameterResponse> resultResponses = parameters.stream()
                                .map(param -> {

                                        TestResultEntity result = resultsByParameterId.get(param.getId());
                                        PreviousValueResponse previousValue = toPreviousValueResponse(
                                                        previousByParameterId.get(param.getId()));

                                        return new ResultParameterResponse(
                                                        param.getId(),
                                                        param.getName(),
                                                        result != null ? result.getResultValue() : null,
                                                        param.getUnit(),
                                                        param.getRefLow(),
                                                        param.getRefHigh(),
                                                        result != null && result.getFlag() != null ? result.getFlag().name()
                                                                        : null,
                                                        previousValue);
                                })
                                .toList();
                String mltNotes = resultsByParameterId.values().stream()
                                .map(TestResultEntity::getMltNotes)
                                .filter(note -> note != null && !note.isBlank())
                                .findFirst()
                                .orElse(null);

                return new SampleResultsResponse(
                                sample.getId(),
                                sample.getBarcode(),
                                sample.getOrderItem().getOrder().getId(),
                                sample.getOrderItem().getOrder().getOrderNo(),
                                sample.getOrderItem().getId(),
                                patientCode,
                                patientName,
                                testCatalog.getTestName(),
                                sample.getStatus().name(),
                                sample.getTubeType().name(),
                                sample.getPriority().name(),
                                sample.getCollectedAt(),
                                sample.getCollectedBy(),
                                resultResponses,
                                mltNotes);
        }

        @Transactional(readOnly = true)
        public List<MltResultActivityItemResponse> getSampleResultActivity(UUID sampleId) {
                sampleRepository.findById(sampleId)
                                .orElseThrow(() -> new ResourceNotFoundException("Sample not found"));

                return auditLogRepository.findByEntityTypeAndEntityIdOrderByTimestampDesc(MLT_ENTITY_TYPE, sampleId)
                                .stream()
                                .map(log -> new MltResultActivityItemResponse(
                                                log.getId(),
                                                log.getAction(),
                                                log.getPerformedBy(),
                                                log.getTimestamp(),
                                                log.getDetails()))
                                .toList();
        }

        @Transactional
        public void submitResults(UUID sampleId, SubmitResultsRequest request) {
                processResults(sampleId, request, false);
        }

        @Transactional
        public void saveDraftResults(UUID sampleId, SubmitResultsRequest request) {
                processResults(sampleId, request, true);
        }

        private void processResults(UUID sampleId, SubmitResultsRequest request, boolean isDraft) {
                SampleEntity sample = sampleRepository.findById(sampleId)
                                .orElseThrow(() -> new ResourceNotFoundException("Sample not found"));
                assertSampleBranchAccess(sample);

                if (isDraft) {
                        if (sample.getStatus() != SampleStatus.ACCEPTED
                                        && sample.getStatus() != SampleStatus.IN_TESTING) {
                                throw new BusinessRuleException(
                                                "Draft results can only be entered for ACCEPTED or IN_TESTING samples");
                        }
                } else if (sample.getStatus() != SampleStatus.IN_TESTING) {
                        throw new BusinessRuleException(
                                        "Final results can only be submitted for IN_TESTING samples");
                }

                if (!sample.getId().equals(request.sampleId())) {
                        throw new BusinessRuleException("Sample ID mismatch");
                }

                UUID sampleTestId = sample.getOrderItem().getTestId();
                List<TestParameterEntity> testParameters = parameterRepository.findByTestIdOrderByDisplayOrderAsc(sampleTestId);

                validateDuplicateParameterIds(request);

                if (!isDraft) {
                        validateFinalSubmissionCompleteness(request, testParameters);
                }

                Map<UUID, String> parameterNames = testParameters.stream()
                                .collect(Collectors.toMap(TestParameterEntity::getId, TestParameterEntity::getName));

                // Resolve the patient's sex/age once so flagging can use age/sex-banded
                // reference ranges (falls back to the parameter's own limits otherwise).
                PatientEntity patientForRanges = patientRepository
                                .findByPatientCode(sample.getOrderItem().getOrder().getPatientId()).orElse(null);
                com.uom.lims.api.common.enums.Gender patientGender =
                                patientForRanges != null ? patientForRanges.getGender() : null;
                Integer patientAge = (patientForRanges != null && patientForRanges.getDob() != null)
                                ? java.time.Period.between(patientForRanges.getDob(), java.time.LocalDate.now()).getYears()
                                : null;

                for (ResultItemRequest item : request.results()) {

                        TestParameterEntity parameter = parameterRepository.findById(item.parameterId())
                                        .orElseThrow(() -> new ResourceNotFoundException("Parameter not found"));

                        if (!parameter.getTestId().equals(sampleTestId)) {
                                throw new BusinessRuleException("Parameter does not belong to the sample's test");
                        }

                        TestResultEntity result = resultRepository
                                        .findBySampleIdAndParameterId(sample.getId(), parameter.getId())
                                        .orElseGet(TestResultEntity::new);

                        // H2 guard: a released (verified/authorized/dispatched) result must never be
                        // silently overwritten through result entry — it can only be corrected via the
                        // amendment workflow, which preserves the original value. The sample-status gate
                        // above is not sufficient because returnToMlt/rejectResult can put a sample back
                        // into IN_TESTING while some of its results are still released.
                        if (isReleased(result.getStatus())) {
                                throw new BusinessRuleException(
                                                "A released result must be amended, not overwritten (result "
                                                                + result.getId() + ", status " + result.getStatus() + ")");
                        }

                        result.setSample(sample);
                        result.setParameter(parameter);
                        result.setResultValue(item.result());
                        // Capture the numeric form (when parseable) for indexing/trending/delta,
                        // and discriminate the value type.
                        BigDecimal numericValue = parseNumericResult(item.result());
                        result.setResultNumeric(numericValue);
                        result.setResultDataType(numericValue != null ? "NUMERIC" : "TEXT");
                        result.setMltNotes(request.mltNotes());
                        result.setDraft(isDraft);
                        result.setFlag(resolveResultFlag(item, parameter, patientGender, patientAge));
                        result.setStatus(isDraft ? null : ResultStatus.ENTERED);

                        // Reassign to the saved instance: BaseEntity's non-null @Version makes
                        // Spring Data merge a new row, so only the RETURNED entity carries the
                        // generated id that openForResult needs.
                        TestResultEntity savedResult = resultRepository.save(result);

                        // H1: a submitted (non-draft) critical result opens a critical-value
                        // callback atomically with the result. openForResult self-guards on
                        // critical flag + de-duplicates, so this is safe to call per result.
                        if (!isDraft) {
                                criticalValueNotificationService.openForResult(savedResult);
                        }
                }

                if (isDraft && sample.getStatus() == SampleStatus.ACCEPTED) {
                        sample.setStatus(SampleStatus.IN_TESTING);
                        sampleRepository.save(sample);
                }

                if (!isDraft) {
                        sample.setStatus(SampleStatus.SENT_FOR_VERIFICATION);
                        sampleRepository.save(sample);
                }

                if (!request.results().isEmpty()) {
                        auditService.log(
                                        isDraft ? ACTION_DRAFT : ACTION_SUBMIT,
                                        MLT_ENTITY_TYPE,
                                        sample.getId(),
                                        sample.getOrderItem().getOrder().getPatientId(),
                                        buildMltResultAuditPayload(sample, request, isDraft, parameterNames),
                                        null);
                }
        }

        /** A result that has been verified, authorized or dispatched is immutable via result entry (H2). */
        private static boolean isReleased(ResultStatus status) {
                return status == ResultStatus.TECHNICALLY_VERIFIED
                                || status == ResultStatus.CLINICALLY_AUTHORIZED
                                || status == ResultStatus.DISPATCHED;
        }

        private Map<UUID, TestResultEntity> resolvePreviousAuthorizedResults(
                        String patientId,
                        UUID testId,
                        UUID sampleId,
                        Instant currentVisitAt) {

                List<TestResultEntity> rows = resultRepository.findPreviousResultsForPatientAndTest(
                                patientId,
                                testId,
                                sampleId,
                                currentVisitAt);

                Map<UUID, TestResultEntity> pickFirst = new LinkedHashMap<>();
                for (TestResultEntity row : rows) {
                        if (row.getStatus() == null || !PREVIOUS_VALUE_STATUSES.contains(row.getStatus())) {
                                continue;
                        }
                        UUID parameterId = row.getParameter().getId();
                        pickFirst.putIfAbsent(parameterId, row);
                }
                return pickFirst;
        }

        private PreviousValueResponse toPreviousValueResponse(TestResultEntity entity) {
                if (entity == null) {
                        return null;
                }

                SampleEntity priorSample = entity.getSample();
                Instant at = priorSample.getCollectedAt() != null ? priorSample.getCollectedAt()
                                : priorSample.getCreatedAt();
                String flag = entity.getFlag() != null ? entity.getFlag().name() : null;

                return new PreviousValueResponse(entity.getResultValue(), flag, at, priorSample.getBarcode());
        }

        private String buildMltResultAuditPayload(
                        SampleEntity sample,
                        SubmitResultsRequest request,
                        boolean isDraft,
                        Map<UUID, String> parameterNames) {

                String testName = testCatalogRepository.findById(sample.getOrderItem().getTestId())
                                .map(TestCatalogEntity::getTestName)
                                .orElse("UNKNOWN_TEST");

                List<Map<String, Object>> parameterRows = new ArrayList<>();
                for (ResultItemRequest item : request.results()) {
                        Map<String, Object> row = new LinkedHashMap<>();
                        row.put("parameterName", parameterNames.getOrDefault(item.parameterId(),
                                        item.parameterId().toString()));
                        row.put("value", item.result());
                        row.put("submittedFlag", item.flag());
                        parameterRows.add(row);
                }

                Map<String, Object> root = new LinkedHashMap<>();
                root.put("barcode", sample.getBarcode());
                root.put("testName", testName);
                root.put("draft", isDraft);
                root.put("mltNotes", request.mltNotes());
                root.put("parameters", parameterRows);

                try {
                        return objectMapper.writeValueAsString(root);
                } catch (JsonProcessingException exception) {
                        throw new BusinessRuleException("Could not create MLT audit payload");
                }
        }

        private void validateFinalSubmissionCompleteness(SubmitResultsRequest request,
                        List<TestParameterEntity> testParameters) {
                Set<UUID> submittedParameterIds = request.results().stream()
                                .map(ResultItemRequest::parameterId)
                                .collect(Collectors.toCollection(HashSet::new));

                Set<UUID> expectedParameterIds = testParameters.stream()
                                .map(TestParameterEntity::getId)
                                .collect(Collectors.toSet());

                if (!submittedParameterIds.containsAll(expectedParameterIds)
                                || submittedParameterIds.size() != expectedParameterIds.size()) {
                        throw new BusinessRuleException(
                                        "All test parameters must be entered before final submission");
                }
        }

        private void validateDuplicateParameterIds(SubmitResultsRequest request) {
                Set<UUID> uniqueParameterIds = new HashSet<>();

                for (ResultItemRequest item : request.results()) {
                        if (!uniqueParameterIds.add(item.parameterId())) {
                                throw new BusinessRuleException(
                                                "Duplicate parameter entries are not allowed in the same submission");
                        }
                }
        }

        @Transactional(readOnly = true)
        public List<MltWorklistItemResponse> getWorklist() {
                return getWorklistByStatuses(List.of(
                                SampleStatus.ACCEPTED,
                                SampleStatus.IN_TESTING));
        }

        @Transactional(readOnly = true)
        public List<MltWorklistItemResponse> getCollectedSamples() {
                return getWorklistByStatuses(List.of(SampleStatus.COLLECTED));
        }

        @Transactional(readOnly = true)
        public List<MltAllWorklistItemResponse> getAllWorklist() {
                // Tenant isolation: MLT worklist scoped to the caller's branch.
                List<SampleEntity> samples = sampleRepository.findAllMltWorklistSamplesInBranch(
                                SecurityUtils.resolveBranchScope());

                List<UUID> testIds = samples.stream()
                                .map(sample -> sample.getOrderItem().getTestId())
                                .distinct()
                                .toList();

                Map<UUID, TestCatalogEntity> testsById = testCatalogRepository.findAllById(testIds).stream()
                                .collect(Collectors.toMap(
                                                TestCatalogEntity::getId,
                                                Function.identity(),
                                                (existing, replacement) -> existing));

                List<String> patientCodes = samples.stream()
                                .map(sample -> sample.getOrderItem().getOrder().getPatientId())
                                .distinct()
                                .toList();

                // Look up only the patients referenced by this page of samples
                // (was findAll() — loaded every patient across all branches).
                Map<String, String> patientNameByCode = patientCodes.isEmpty()
                                ? java.util.Map.of()
                                : patientRepository.findByPatientCodeIn(patientCodes).stream()
                                                .collect(Collectors.toMap(
                                                                PatientEntity::getPatientCode,
                                                                PatientEntity::getFullName,
                                                                (existing, replacement) -> existing));

                return samples.stream()
                                .map(sample -> {
                                        TestCatalogEntity testCatalog = testsById.get(sample.getOrderItem().getTestId());
                                        String patientCode = sample.getOrderItem().getOrder().getPatientId();

                                        return new MltAllWorklistItemResponse(
                                                        sample.getId(),
                                                        sample.getBarcode(),
                                                        sample.getOrderItem().getOrder().getOrderNo(),
                                                        patientCode,
                                                        patientNameByCode.getOrDefault(patientCode, "UNKNOWN_PATIENT"),
                                                        testCatalog != null ? testCatalog.getTestName() : "UNKNOWN_TEST",
                                                        testCatalog != null ? testCatalog.getCategory() : "General",
                                                        sample.getPriority().name(),
                                                        sample.getStatus().name(),
                                                        sample.getCollectedAt());
                                })
                                .toList();
        }

        private List<MltWorklistItemResponse> getWorklistByStatuses(List<SampleStatus> statuses) {

                // Tenant isolation: MLT worklist scoped to the caller's branch.
                List<SampleEntity> samples = sampleRepository
                                .findByStatusInAndBranchOrderByCollectedAt(statuses,
                                                SecurityUtils.resolveBranchScope());
                List<UUID> testIds = samples.stream()
                                .map(sample -> sample.getOrderItem().getTestId())
                                .distinct()
                                .toList();
                Map<UUID, String> testNameById = testCatalogRepository.findAllById(testIds).stream()
                                .collect(Collectors.toMap(
                                                TestCatalogEntity::getId,
                                                TestCatalogEntity::getTestName,
                                                (existing, replacement) -> existing));

                return samples.stream()
                                .map(sample -> new MltWorklistItemResponse(
                                                sample.getId(),
                                                sample.getBarcode(),
                                                sample.getOrderItem().getOrder().getOrderNo(),
                                                sample.getOrderItem().getId(),
                                                sample.getOrderItem().getOrder().getPatientId(),
                                                testNameById.getOrDefault(sample.getOrderItem().getTestId(),
                                                                "UNKNOWN_TEST"),
                                                sample.getPriority().name(),
                                                sample.getStatus().name(),
                                                sample.getCollectedAt()))
                                .toList();
        }

        @Transactional
        public void acceptSample(UUID sampleId) {

                SampleEntity sample = sampleRepository.findById(sampleId)
                                .orElseThrow(() -> new ResourceNotFoundException("Sample not found"));
                assertSampleBranchAccess(sample);

                if (sample.getStatus() != SampleStatus.COLLECTED) {
                        throw new BusinessRuleException("Only COLLECTED samples can be accepted");
                }

                sample.setStatus(SampleStatus.ACCEPTED);
                sampleRepository.save(sample);

                auditService.log(
                                "ACCEPTED",
                                "SAMPLE_ACCESSIONING",
                                sample.getId(),
                                sample.getOrderItem().getOrder().getPatientId(),
                                buildAccessioningAuditDetails(sample, SampleStatus.ACCEPTED, null),
                                null);
        }

        @Transactional
        public void rejectSample(UUID sampleId, SampleRejectRequest request) {

                SampleEntity sample = sampleRepository.findById(sampleId)
                                .orElseThrow(() -> new ResourceNotFoundException("Sample not found"));
                assertSampleBranchAccess(sample);

                if (sample.getStatus() != SampleStatus.COLLECTED) {
                        throw new BusinessRuleException("Only COLLECTED samples can be rejected");
                }

                if (request.getRejectionReason() == com.uom.lims.api.enums.RejectionReason.OTHER
                                && (request.getRejectionNotes() == null || request.getRejectionNotes().isBlank())) {
                        throw new BusinessRuleException("Rejection notes are mandatory when rejection reason is OTHER");
                }

                sample.setStatus(SampleStatus.REJECTED);
                sample.setRejectionReason(request.getRejectionReason());
                sample.setRejectionNotes(request.getRejectionNotes());
                sample.setRejectedAt(Instant.now());
                sample.setRejectedBy(SecurityUtils.getCurrentUsername());

                sampleRepository.save(sample);

                auditService.log(
                                "REJECTED",
                                "SAMPLE_ACCESSIONING",
                                sample.getId(),
                                sample.getOrderItem().getOrder().getPatientId(),
                                buildAccessioningAuditDetails(sample, SampleStatus.REJECTED, request.getRejectionNotes()),
                                null);
        }

        private String buildAccessioningAuditDetails(SampleEntity sample, SampleStatus status, String notes) {
                String patientCode = sample.getOrderItem().getOrder().getPatientId();
                String patientName = patientRepository.findByPatientCode(patientCode)
                                .map(PatientEntity::getFullName)
                                .orElse("UNKNOWN_PATIENT");
                String testName = testCatalogRepository.findById(sample.getOrderItem().getTestId())
                                .map(TestCatalogEntity::getTestName)
                                .orElse("UNKNOWN_TEST");

                Map<String, Object> details = new LinkedHashMap<>();
                details.put("sampleId", sample.getBarcode());
                details.put("patientName", patientName);
                details.put("pid", patientCode);
                details.put("testType", testName);
                details.put("priority", sample.getPriority().name());
                details.put("status", status.name());
                details.put("notes", notes);
                if (sample.getRejectionReason() != null) {
                        details.put("rejectionReason", sample.getRejectionReason().name());
                }

                try {
                        return objectMapper.writeValueAsString(details);
                } catch (JsonProcessingException exception) {
                        throw new BusinessRuleException("Could not create accessioning audit log details");
                }
        }

        /** Tenant isolation: a branch user may only act on a sample in their branch. */
        private void assertSampleBranchAccess(SampleEntity sample) {
                String branch = (sample.getOrderItem() != null && sample.getOrderItem().getOrder() != null)
                                ? sample.getOrderItem().getOrder().getBranchCode()
                                : null;
                if (!SecurityUtils.canAccessBranch(branch)) {
                        throw new ResourceNotFoundException("Sample not found");
                }
        }

        private ResultFlag resolveResultFlag(ResultItemRequest item, TestParameterEntity parameter,
                        com.uom.lims.api.common.enums.Gender gender, Integer ageYears) {
                ResultFlag submittedFlag = null;
                if (item.flag() != null && !item.flag().isBlank()) {
                        try {
                                submittedFlag = ResultFlag.valueOf(item.flag().trim().toUpperCase(Locale.ROOT));
                        } catch (IllegalArgumentException ex) {
                                throw new BusinessRuleException("Invalid result flag: " + item.flag());
                        }

                        if (submittedFlag == ResultFlag.CRITICAL_HIGH || submittedFlag == ResultFlag.CRITICAL_LOW) {
                                return submittedFlag;
                        }
                }

                BigDecimal numericResult = parseNumericResult(item.result());

                if (numericResult != null) {
                        // Prefer an age/sex-banded reference range when configured; otherwise
                        // use the parameter's own reference/critical limits.
                        BigDecimal refLow = parameter.getRefLow();
                        BigDecimal refHigh = parameter.getRefHigh();
                        BigDecimal critLow = parameter.getCriticalLow();
                        BigDecimal critHigh = parameter.getCriticalHigh();
                        com.uom.lims.refrange.ReferenceRangeEntity banded =
                                        referenceRangeService.resolve(parameter.getId(), gender, ageYears);
                        if (banded != null) {
                                if (banded.getRefLow() != null) refLow = banded.getRefLow();
                                if (banded.getRefHigh() != null) refHigh = banded.getRefHigh();
                                if (banded.getCriticalLow() != null) critLow = banded.getCriticalLow();
                                if (banded.getCriticalHigh() != null) critHigh = banded.getCriticalHigh();
                        }
                        ResultFlag computed = com.uom.lims.results.ResultFlagResolver.fromThresholds(
                                        numericResult, refLow, refHigh, critLow, critHigh);
                        if (computed != null) {
                                return computed;
                        }
                }

                return submittedFlag;
        }

        private BigDecimal parseNumericResult(String resultValue) {
                if (resultValue == null || resultValue.isBlank()) {
                        return null;
                }

                try {
                        return new BigDecimal(resultValue.trim());
                } catch (NumberFormatException ex) {
                        return null;
                }
        }
}
