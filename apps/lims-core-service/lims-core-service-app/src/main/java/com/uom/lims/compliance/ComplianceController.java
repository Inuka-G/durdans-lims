package com.uom.lims.compliance;

import com.uom.lims.api.dto.response.ApiResponse;
import com.uom.lims.security.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sri Lanka PDPA data-subject-request endpoints. Consent may be recorded by any
 * authenticated staff member (typically at registration); access export and
 * right-to-erasure are restricted to SUPER_ADMIN and fully audited.
 */
@RestController
@RequestMapping("/api/v1/compliance")
@RequiredArgsConstructor
public class ComplianceController {

    private final DataSubjectRequestService dsrService;
    // ClientIpResolver is a static utility (not a Spring bean) — call it statically.

    @PostMapping("/patients/{code}/consent")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> recordConsent(
            @PathVariable String code,
            @RequestParam(defaultValue = "v1") String version,
            HttpServletRequest request) {
        dsrService.recordConsent(code, version, ClientIpResolver.resolve(request));
        return ResponseEntity.ok(ApiResponse.success(null, "Consent recorded"));
    }

    @GetMapping("/patients/{code}/export")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<DataSubjectRequestService.PatientDataExport>> export(
            @PathVariable String code, HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                dsrService.export(code, ClientIpResolver.resolve(request))));
    }

    @PostMapping("/patients/{code}/erase")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> erase(
            @PathVariable String code,
            @RequestParam(required = false) String reason,
            HttpServletRequest request) {
        dsrService.erase(code, reason, ClientIpResolver.resolve(request));
        return ResponseEntity.ok(ApiResponse.success(null, "Patient record anonymised"));
    }
}
