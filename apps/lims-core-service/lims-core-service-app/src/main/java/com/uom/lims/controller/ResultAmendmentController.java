package com.uom.lims.controller;

import com.uom.lims.api.verification.dto.request.ResultAmendmentRequest;
import com.uom.lims.api.verification.dto.response.ResultAmendmentResponse;
import com.uom.lims.service.ResultAmendmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Result amendment / versioning endpoints (H2). Amending a released result is a
 * privileged clinical correction, so it is limited to the supervisor/pathologist
 * tiers; history is readable more broadly for transparency.
 */
@RestController
@RequestMapping("/api/v1/results")
@RequiredArgsConstructor
public class ResultAmendmentController {

    private final ResultAmendmentService resultAmendmentService;

    @PreAuthorize("hasAnyRole('PATHOLOGIST','LAB_SUPERVISOR','BRANCH_ADMIN','SUPER_ADMIN')")
    @PostMapping("/{resultId}/amend")
    public ResultAmendmentResponse amend(@PathVariable UUID resultId,
                                         @RequestBody ResultAmendmentRequest request) {
        return resultAmendmentService.amendResult(resultId, request);
    }

    @PreAuthorize("hasAnyRole('PATHOLOGIST','LAB_SUPERVISOR','LAB_RECEPTIONIST','LAB_RECEPTION','BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping("/{resultId}/amendments")
    public List<ResultAmendmentResponse> history(@PathVariable UUID resultId) {
        return resultAmendmentService.getAmendmentHistory(resultId);
    }
}
