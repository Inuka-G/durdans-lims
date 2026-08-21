package com.uom.lims.controller;

import com.uom.lims.api.clinical.dto.request.ClinicalAuthRequest;
import com.uom.lims.api.clinical.dto.request.ReturnToMLTRequest;
import com.uom.lims.api.common.PageResponse;
import com.uom.lims.api.verification.dto.response.TestResultDetailResponse;
import com.uom.lims.api.verification.dto.response.TestResultSummaryResponse;
import com.uom.lims.api.verification.dto.response.VerificationHistoryItemResponse;
import com.uom.lims.service.ClinicalAuthorizationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

import java.time.LocalDateTime;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/clinical")
@Tag(name = "Clinical Authorization", description = "Pathologist clinical authorization APIs")
public class ClinicalAuthorizationController {

    private final ClinicalAuthorizationService clinicalAuthorizationService;

    // Reads are open to admins as well (read-only oversight); the two state-changing
    // actions below stay with PATHOLOGIST alone — a clinical authorization is a
    // medico-legal signature, not an administrative one.
    @PreAuthorize("hasAnyRole('PATHOLOGIST','BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping("/pending")
    @Operation(summary = "Get pending test results for clinical authorization")
    public PageResponse<TestResultSummaryResponse> getPendingResults(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Page<TestResultSummaryResponse> result =
                clinicalAuthorizationService.getPendingResults(page, size);

        return new PageResponse<>(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.isLast()
        );
    }

    @PreAuthorize("hasAnyRole('PATHOLOGIST','BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping("/history")
    @Operation(summary = "Get clinical authorization history items")
    public PageResponse<VerificationHistoryItemResponse> getClinicalHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String actionType,
            @RequestParam(required = false) String search,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromTimestamp) {

        Page<VerificationHistoryItemResponse> result =
                clinicalAuthorizationService.getClinicalHistory(page, size, actionType, search, fromTimestamp);

        return new PageResponse<>(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.isLast()
        );
    }

    @PreAuthorize("hasAnyRole('PATHOLOGIST','BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping("/{resultId}")
    @Operation(summary = "Get test result details for clinical authorization")
    public TestResultDetailResponse getResultDetails(@PathVariable UUID resultId) {
        return clinicalAuthorizationService.getResultDetails(resultId);
    }

    @PreAuthorize("hasRole('PATHOLOGIST')")
    @PostMapping("/{resultId}/authorize")
    @Operation(summary = "Clinically authorize a test result")
    public TestResultDetailResponse authorizeResult(
            @PathVariable UUID resultId,
            @Valid @RequestBody ClinicalAuthRequest request) {

        return clinicalAuthorizationService.authorizeResult(resultId, request);
    }

    @PreAuthorize("hasRole('PATHOLOGIST')")
    @PostMapping("/{resultId}/return")
    @Operation(summary = "Return test result to lab supervisor")
    public TestResultDetailResponse returnToSupervisor(
            @PathVariable UUID resultId,
            @Valid @RequestBody ReturnToMLTRequest request) {

        return clinicalAuthorizationService.returnToMlt(resultId, request);
    }
}
