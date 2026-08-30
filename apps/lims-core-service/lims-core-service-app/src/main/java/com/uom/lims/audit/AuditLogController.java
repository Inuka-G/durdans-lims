package com.uom.lims.audit;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.api.common.PageResponse;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.security.ClientIpResolver;
import com.uom.lims.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/audit-logs")
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;
    private final AuditService auditService;
    private final AuditChainVerifier auditChainVerifier;
    private final PatientRepository patientRepository;
    private final ObjectMapper objectMapper;

    public static final String ENTITY_REVENUE_REPORT = "REVENUE_REPORT";
    public static final String ACTION_REVENUE_REPORT_VIEWED = "REVENUE_REPORT_VIEWED";
    public static final String ACTION_REVENUE_REPORT_EXPORTED = "REVENUE_REPORT_EXPORTED";

    @PreAuthorize("hasAnyRole('FRONT_DESK','LAB_RECEPTIONIST','LAB_RECEPTION','BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping
    public PageResponse<AuditLogResponse> getAuditLogs(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String performedBy,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String branchCode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "desc") String sortDir) {

        try {
            Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
            Pageable pageable = PageRequest.of(page, size, Sort.by(direction, "timestamp"));

            // Normalize empty strings to null
            action = normalizeParam(action);
            entityType = normalizeParam(entityType);
            performedBy = normalizeParam(performedBy);
            search = normalizeParam(search);

            Page<AuditLog> result;

            if (isSuperAdmin()) {
                log.info("Super admin requesting audit logs");
                String normalizedBranchCode = normalizeParam(branchCode);
                if (normalizedBranchCode != null && !"ALL".equalsIgnoreCase(normalizedBranchCode)) {
                    result = auditLogRepository.findByBranchCodeFiltered(normalizedBranchCode, action, entityType, performedBy, search, startDate, endDate, pageable);
                } else {
                    result = auditLogRepository.findAllFiltered(action, entityType, performedBy, search, startDate, endDate, pageable);
                }
            } else {
                String currentBranchCode = SecurityUtils.getCurrentBranchId();
                log.info("User requesting audit logs for branch: {}", currentBranchCode);
                if (currentBranchCode == null || currentBranchCode.isBlank()) {
                    currentBranchCode = "SYSTEM";
                    log.warn("Branch code missing from JWT. Falling back to audit branch scope: {}", currentBranchCode);
                    result = auditLogRepository.findByBranchCodeFiltered(currentBranchCode, action, entityType, performedBy,
                            search, startDate, endDate, pageable);
                } else {
                    result = auditLogRepository.findByBranchCodeFiltered(currentBranchCode, action, entityType, performedBy,
                            search, startDate, endDate, pageable);
                }
            }

            List<AuditLogResponse> responses = result.getContent().stream()
                    .map(this::toResponse)
                    .collect(Collectors.toList());

            return new PageResponse<>(
                    responses,
                    result.getNumber(),
                    result.getSize(),
                    result.getTotalElements(),
                    result.getTotalPages(),
                    result.isLast());

        } catch (Exception e) {
            log.error("Error fetching audit logs", e);
            throw e;
        }
    }

    /**
     * Records revenue report screen access. {@code performedBy} is resolved from the security context.
     */
    @PreAuthorize("hasAnyRole('FRONT_DESK','BRANCH_ADMIN','SUPER_ADMIN')")
    @PostMapping("/revenue-report-access")
    public ResponseEntity<Void> recordRevenueReportAccess(
            @RequestBody(required = false) RevenueReportAccessRequest body,
            HttpServletRequest request) {
        String event = body != null && body.getEvent() != null ? body.getEvent().trim().toUpperCase() : "VIEW";
        String action = "EXPORT".equals(event) ? ACTION_REVENUE_REPORT_EXPORTED : ACTION_REVENUE_REPORT_VIEWED;
        String details = body != null ? body.getDetail() : null;
        auditService.writeStandalone(action, ENTITY_REVENUE_REPORT, null, null, details,
                ClientIpResolver.resolve(request));
        return ResponseEntity.noContent().build();
    }

    /**
     * Verifies the tamper-evident audit hash chain (H3). SUPER_ADMIN only: a positive
     * result is evidence the audit trail has not been retro-actively altered; a break
     * names the first offending row. Safe to run on demand or from a scheduled job.
     */
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @GetMapping("/verify-chain")
    public AuditChainVerificationResult verifyChain() {
        AuditChainVerificationResult result = auditChainVerifier.verifyChain();
        if (!result.valid()) {
            log.error("AUDIT CHAIN INTEGRITY FAILURE: {}", result.message());
        } else {
            log.info("Audit chain verified: {} sealed rows intact", result.rowsChecked());
        }
        return result;
    }

    private String normalizeParam(String param) {
        return (param != null && !param.isBlank()) ? param.trim() : null;
    }

    private boolean isSuperAdmin() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null)
                return false;
            return auth.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .anyMatch(a -> a.equals("ROLE_SUPER_ADMIN"));
        } catch (Exception e) {
            log.warn("Could not determine super admin status", e);
            return false;
        }
    }

    private AuditLogResponse toResponse(AuditLog auditLog) {
        AuditLogResponse r = new AuditLogResponse();
        r.setId(auditLog.getId() != null ? auditLog.getId().toString() : "");
        r.setAction(auditLog.getAction());
        r.setEntityType(auditLog.getEntityType());
        r.setEntityId(auditLog.getEntityId() != null ? auditLog.getEntityId().toString() : null);
        r.setPatientCode(auditLog.getPatientCode());
        r.setPerformedBy(auditLog.getPerformedBy());
        r.setBranchCode(auditLog.getBranchCode());
        r.setIpAddress(auditLog.getIpAddress());
        // Stamped with the offset, not bare. LocalDateTime.toString() emits
        // "2026-08-21T18:30:00" with nothing to say which zone that is, and a
        // date-time string carrying no offset is parsed by every browser as *local*
        // time. The value is UTC, so in Colombo (+5:30) every audit row displayed
        // 5h30m early - and anything logged after 18:30 local showed up under the
        // previous day's date. Appending the offset lets the browser convert.
        r.setTimestamp(auditLog.getTimestamp() != null
                ? auditLog.getTimestamp().atOffset(java.time.ZoneOffset.UTC).toString()
                : "");
        r.setDetails(enrichPatientNameInDetails(auditLog));
        return r;
    }

    private String enrichPatientNameInDetails(AuditLog auditLog) {
        String details = auditLog.getDetails();
        if (details == null || details.isBlank() || auditLog.getPatientCode() == null || auditLog.getPatientCode().isBlank()) {
            return details;
        }

        try {
            Map<String, Object> detailMap = objectMapper.readValue(details, new TypeReference<>() {
            });
            Object patientNameValue = detailMap.get("patientName");
            String patientName = patientNameValue != null ? patientNameValue.toString() : null;

            if (patientName != null && !patientName.isBlank() && !"UNKNOWN_PATIENT".equals(patientName)) {
                return details;
            }

            String resolvedPatientName = patientRepository.findByPatientCode(auditLog.getPatientCode())
                    .map(PatientEntity::getFullName)
                    .orElse(null);

            if (resolvedPatientName == null || resolvedPatientName.isBlank()) {
                return details;
            }

            detailMap.put("patientName", resolvedPatientName);
            return objectMapper.writeValueAsString(detailMap);
        } catch (Exception exception) {
            log.warn("Could not enrich patient name for audit log {}", auditLog.getId(), exception);
            return details;
        }
    }
}
