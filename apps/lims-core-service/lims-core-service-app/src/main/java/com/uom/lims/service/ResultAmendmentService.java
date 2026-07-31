package com.uom.lims.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.verification.dto.request.ResultAmendmentRequest;
import com.uom.lims.api.verification.dto.response.ResultAmendmentResponse;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.audit.AuditService;
import com.uom.lims.entity.TestParameterEntity;
import com.uom.lims.entity.TestResultAmendmentEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.exception.BusinessRuleException;
import com.uom.lims.exception.InvalidRequestException;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.repository.TestResultAmendmentRepository;
import com.uom.lims.repository.TestResultRepository;
import com.uom.lims.results.ResultFlagResolver;
import com.uom.lims.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Result amendment / versioning (H2).
 *
 * <p>A "released" result — one that has been technically verified, clinically
 * authorized, or dispatched — must never be silently overwritten. Correcting it
 * snapshots the prior value into {@link TestResultAmendmentEntity} (immutable
 * history), bumps the live row's {@code versionNo}, marks it amended, and records the
 * reason + e-signature in the tamper-evident audit log. A correction to an already
 * DISPATCHED result additionally raises a CORRECTED_REPORT_REQUIRED audit event so a
 * revised report can be re-issued.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResultAmendmentService {

    /** Released = no longer freely editable via the normal entry path; must be amended. */
    private static final Set<ResultStatus> RELEASED = EnumSet.of(
            ResultStatus.TECHNICALLY_VERIFIED,
            ResultStatus.CLINICALLY_AUTHORIZED,
            ResultStatus.DISPATCHED);

    private static final String AMEND_ENTITY_TYPE = "TEST_RESULT_AMENDMENT";
    private static final String ACTION_AMENDED = "RESULT_AMENDED";
    private static final String ACTION_CORRECTED_REPORT_REQUIRED = "CORRECTED_REPORT_REQUIRED";

    private final TestResultRepository testResultRepository;
    private final TestResultAmendmentRepository amendmentRepository;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    @Transactional
    public ResultAmendmentResponse amendResult(UUID resultId, ResultAmendmentRequest request) {
        if (request == null || request.getNewValue() == null || request.getNewValue().isBlank()) {
            throw new InvalidRequestException("A new result value is required to amend a result.");
        }
        if (request.getAmendmentReason() == null || request.getAmendmentReason().isBlank()) {
            throw new InvalidRequestException("An amendment reason is required (CLIA/CAP corrected-report rule).");
        }
        if (!Boolean.TRUE.equals(request.getSignatureConfirmed())) {
            throw new InvalidRequestException("Signature confirmation is required before amending a released result.");
        }

        TestResultEntity result = testResultRepository.findById(resultId)
                .orElseThrow(() -> new ResourceNotFoundException("Test result not found: " + resultId));

        assertBranchAccess(result);

        if (!RELEASED.contains(result.getStatus())) {
            throw new BusinessRuleException(
                    "Only a released (verified/authorized/dispatched) result can be amended; "
                            + "edit an unreleased result through result entry. Current status: " + result.getStatus());
        }

        // ---- snapshot the prior (pre-correction) state ----
        String previousValue = result.getResultValue();
        BigDecimal previousNumeric = result.getResultNumeric();
        ResultFlag previousFlag = result.getFlag();
        ResultStatus previousStatus = result.getStatus();

        // ---- compute the new state ----
        String newValue = request.getNewValue().trim();
        BigDecimal newNumeric = parseNumeric(newValue);
        ResultFlag newFlag = resolveNewFlag(request.getNewFlag(), newNumeric, result.getParameter(), previousFlag);

        int newVersion = (result.getVersionNo() == null ? 1 : result.getVersionNo()) + 1;
        String username = SecurityUtils.getCurrentUsername();
        Instant now = Instant.now();
        String signature = String.format("Amended by %s on %s", username, now);

        TestResultAmendmentEntity amendment = new TestResultAmendmentEntity();
        amendment.setTestResultId(result.getId());
        amendment.setVersionNo(newVersion);
        amendment.setPreviousValue(previousValue);
        amendment.setPreviousNumeric(previousNumeric);
        amendment.setPreviousFlag(previousFlag == null ? null : previousFlag.name());
        amendment.setPreviousStatus(previousStatus == null ? null : previousStatus.name());
        amendment.setNewValue(newValue);
        amendment.setNewNumeric(newNumeric);
        amendment.setNewFlag(newFlag == null ? null : newFlag.name());
        amendment.setAmendmentReason(request.getAmendmentReason().trim());
        amendment.setAmendedBy(username);
        amendment.setAmendedAt(now);
        amendment.setSignature(signature);
        amendmentRepository.save(amendment);

        // ---- update the live row in place (stays reportable; existing queries unaffected) ----
        result.setResultValue(newValue);
        result.setResultNumeric(newNumeric);
        result.setResultDataType(newNumeric != null ? "NUMERIC" : "TEXT");
        result.setFlag(newFlag);
        result.setVersionNo(newVersion);
        result.setAmended(true);
        result.setLastModifiedBy(username);
        result.setLastModifiedAt(now);
        testResultRepository.save(result);

        auditService.log(ACTION_AMENDED, AMEND_ENTITY_TYPE, result.getId(),
                resolvePatientCode(result), buildAuditPayload(amendment), null);

        if (previousStatus == ResultStatus.DISPATCHED) {
            // A wrong result already left the building — a corrected report must be re-issued.
            auditService.log(ACTION_CORRECTED_REPORT_REQUIRED, AMEND_ENTITY_TYPE, result.getId(),
                    resolvePatientCode(result), buildAuditPayload(amendment), null);
            log.warn("Result {} amended after DISPATCH (v{}): a corrected report must be re-issued",
                    result.getId(), newVersion);
        }

        return toResponse(amendment);
    }

    @Transactional(readOnly = true)
    public List<ResultAmendmentResponse> getAmendmentHistory(UUID resultId) {
        TestResultEntity result = testResultRepository.findById(resultId)
                .orElseThrow(() -> new ResourceNotFoundException("Test result not found: " + resultId));
        assertBranchAccess(result);
        return amendmentRepository.findByTestResultIdOrderByVersionNoDesc(resultId).stream()
                .map(this::toResponse)
                .toList();
    }

    private ResultFlag resolveNewFlag(String requested, BigDecimal numeric, TestParameterEntity parameter,
                                      ResultFlag fallback) {
        if (requested != null && !requested.isBlank()) {
            try {
                return ResultFlag.valueOf(requested.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new InvalidRequestException("Unknown result flag: " + requested);
            }
        }
        if (numeric != null && parameter != null) {
            ResultFlag computed = ResultFlagResolver.fromThresholds(
                    numeric, parameter.getRefLow(), parameter.getRefHigh(),
                    parameter.getCriticalLow(), parameter.getCriticalHigh());
            if (computed != null) {
                return computed;
            }
        }
        return fallback;
    }

    private void assertBranchAccess(TestResultEntity result) {
        String branch = resolveBranchCode(result);
        if (!SecurityUtils.canAccessBranch(branch)) {
            // 404 rather than 403 so cross-branch existence is not leaked (tenant isolation).
            throw new ResourceNotFoundException("Test result not found: " + result.getId());
        }
    }

    private String resolveBranchCode(TestResultEntity result) {
        try {
            return result.getSample().getOrderItem().getOrder().getBranchCode();
        } catch (Exception e) {
            return null;
        }
    }

    private String resolvePatientCode(TestResultEntity result) {
        try {
            return result.getSample().getOrderItem().getOrder().getPatientId();
        } catch (Exception e) {
            return null;
        }
    }

    private BigDecimal parseNumeric(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String buildAuditPayload(TestResultAmendmentEntity amendment) {
        Map<String, String> details = new HashMap<>();
        details.put("versionNo", String.valueOf(amendment.getVersionNo()));
        details.put("previousValue", amendment.getPreviousValue());
        details.put("newValue", amendment.getNewValue());
        details.put("previousFlag", amendment.getPreviousFlag());
        details.put("newFlag", amendment.getNewFlag());
        details.put("previousStatus", amendment.getPreviousStatus());
        details.put("reason", amendment.getAmendmentReason());
        try {
            return objectMapper.writeValueAsString(details);
        } catch (Exception e) {
            return "{\"reason\":\"" + amendment.getAmendmentReason() + "\"}";
        }
    }

    private ResultAmendmentResponse toResponse(TestResultAmendmentEntity a) {
        return ResultAmendmentResponse.builder()
                .amendmentId(a.getId() == null ? null : a.getId().toString())
                .resultId(a.getTestResultId() == null ? null : a.getTestResultId().toString())
                .versionNo(a.getVersionNo())
                .previousValue(a.getPreviousValue())
                .previousFlag(a.getPreviousFlag())
                .previousStatus(a.getPreviousStatus())
                .newValue(a.getNewValue())
                .newFlag(a.getNewFlag())
                .amendmentReason(a.getAmendmentReason())
                .amendedBy(a.getAmendedBy())
                .amendedAt(a.getAmendedAt())
                .signature(a.getSignature())
                .build();
    }
}
