package com.uom.lims.controller;

import com.uom.lims.api.common.PageResponse;
import com.uom.lims.api.dto.response.VerificationPendingItemResponse;
import com.uom.lims.api.verification.dto.request.BulkVerificationRequest;
import com.uom.lims.api.verification.dto.response.BulkVerificationBatchResponse;
import com.uom.lims.api.verification.dto.request.VerificationRequest;
import com.uom.lims.api.verification.dto.response.TestResultDetailResponse;
import com.uom.lims.api.verification.dto.response.TestResultSummaryResponse;
import com.uom.lims.api.verification.dto.response.VerificationHistoryItemResponse;
import com.uom.lims.service.VerificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/verification")
@Tag(name = "Verification", description = "Senior MLT technical verification APIs")
public class VerificationController {

    private final VerificationService verificationService;

    @PreAuthorize("hasAnyRole('LAB_SUPERVISOR','BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping("/pending")
    @Operation(summary = "Get pending samples for supervisor verification queue")
    public ResponseEntity<List<VerificationPendingItemResponse>> getPendingSamples() {
        return ResponseEntity.ok(verificationService.getPendingSamples());
    }

    @PreAuthorize("hasAnyRole('LAB_SUPERVISOR','BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping("/pending-results")
    @Operation(summary = "Get pending test results for technical verification")
    public PageResponse<TestResultSummaryResponse> getPendingResults(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Page<TestResultSummaryResponse> result = verificationService.getPendingResults(page, size);

        return new PageResponse<>(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.isLast());
    }

    @PreAuthorize("hasAnyRole('LAB_SUPERVISOR','BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping("/history")
    @Operation(summary = "Get verification history items")
    public PageResponse<VerificationHistoryItemResponse> getVerificationHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String actionType,
            @RequestParam(required = false) String search) {

        Page<VerificationHistoryItemResponse> result =
                verificationService.getVerificationHistory(page, size, actionType, search);

        return new PageResponse<>(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.isLast()
        );
    }

    @PreAuthorize("hasAnyRole('LAB_SUPERVISOR','BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping("/{resultId:[0-9a-fA-F\\-]{36}}")
    @Operation(summary = "Get test result details for technical verification")
    public TestResultDetailResponse getResultDetails(@PathVariable UUID resultId) {
        return verificationService.getResultDetails(resultId);
    }

    @PreAuthorize("hasAnyRole('LAB_SUPERVISOR','BRANCH_ADMIN','SUPER_ADMIN')")
    @PostMapping("/{resultId:[0-9a-fA-F\\-]{36}}/verify")
    @Operation(summary = "Technically verify a test result")
    public TestResultDetailResponse verifyResult(
            @PathVariable UUID resultId,
            @Valid @RequestBody VerificationRequest request) {

        return verificationService.verifyResult(resultId, request);
    }

    @PreAuthorize("hasAnyRole('LAB_SUPERVISOR','BRANCH_ADMIN','SUPER_ADMIN')")
    @PostMapping("/{resultId:[0-9a-fA-F\\-]{36}}/reject")
    @Operation(summary = "Reject a test result during technical verification")
    public TestResultDetailResponse rejectResult(
            @PathVariable UUID resultId,
            @Valid @RequestBody VerificationRequest request) {

        return verificationService.rejectResult(resultId, request);
    }

    @PreAuthorize("hasAnyRole('LAB_SUPERVISOR','BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping("/bulk/worklist")
    @Operation(summary = "Get grouped bulk verification worklist")
    public List<BulkVerificationBatchResponse> getBulkWorklist() {
        return verificationService.getBulkWorklist();
    }

    @PreAuthorize("hasAnyRole('LAB_SUPERVISOR','BRANCH_ADMIN','SUPER_ADMIN')")
    @PostMapping("/bulk-verify")
    @Operation(summary = "Bulk verify test results")
    public Map<String, String> bulkVerify(@Valid @RequestBody BulkVerificationRequest request) {
        return verificationService.bulkVerify(request);
    }
}
