package com.uom.lims.controller;

import com.uom.lims.api.dto.response.MltWorklistItemResponse;
import com.uom.lims.api.dto.response.MltAllWorklistItemResponse;
import com.uom.lims.api.dto.response.MltResultActivityItemResponse;
import java.util.List;
import com.uom.lims.api.dto.request.SubmitResultsRequest;
import jakarta.validation.Valid;
import com.uom.lims.api.dto.response.SampleResultsResponse;
import com.uom.lims.service.MltTestingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mlt")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('MLT','LAB_SUPERVISOR','BRANCH_ADMIN','SUPER_ADMIN')")
public class MltTestingController {

    private final MltTestingService mltTestingService;

    @PostMapping("/samples/{id}/results")
    public ResponseEntity<Void> submitResults(
            @PathVariable UUID id,
            @Valid @RequestBody SubmitResultsRequest request) {
        mltTestingService.submitResults(id, request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/samples/{id}/results/draft")
    public ResponseEntity<Void> saveDraftResults(
            @PathVariable UUID id,
            @Valid @RequestBody SubmitResultsRequest request) {
        mltTestingService.saveDraftResults(id, request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/samples/{id}/results")
    public ResponseEntity<SampleResultsResponse> getSampleResults(@PathVariable UUID id) {
        return ResponseEntity.ok(mltTestingService.getSampleResults(id));
    }

    @GetMapping("/samples/{id}/result-activity")
    public ResponseEntity<List<MltResultActivityItemResponse>> getSampleResultActivity(@PathVariable UUID id) {
        return ResponseEntity.ok(mltTestingService.getSampleResultActivity(id));
    }

    @GetMapping("/worklist")
    public ResponseEntity<List<MltWorklistItemResponse>> getWorklist() {
        return ResponseEntity.ok(mltTestingService.getWorklist());
    }

    @GetMapping("/all-worklist")
    public ResponseEntity<List<MltAllWorklistItemResponse>> getAllWorklist() {
        return ResponseEntity.ok(mltTestingService.getAllWorklist());
    }
}
