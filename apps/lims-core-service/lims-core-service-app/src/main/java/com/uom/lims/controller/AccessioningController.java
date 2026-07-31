package com.uom.lims.controller;

import com.uom.lims.api.dto.request.SampleRejectRequest;
import com.uom.lims.api.dto.response.MltWorklistItemResponse;
import com.uom.lims.service.MltTestingService;
import com.uom.lims.service.SampleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reception/samples")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('LAB_RECEPTIONIST','LAB_RECEPTION','BRANCH_ADMIN','SUPER_ADMIN')")
public class AccessioningController {

    private final MltTestingService mltTestingService;
    private final SampleService sampleService;

    @GetMapping
    public ResponseEntity<List<MltWorklistItemResponse>> getCollectedSamples() {
        return ResponseEntity.ok(mltTestingService.getCollectedSamples());
    }

    @GetMapping("/search")
    public ResponseEntity<List<com.uom.lims.api.dto.response.SampleResponse>> searchSamplesForReprint(
            @RequestParam("query") String query) {
        return ResponseEntity.ok(sampleService.searchSamplesForReprint(query));
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<Void> acceptSample(@PathVariable UUID id) {
        mltTestingService.acceptSample(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<Void> rejectSample(
            @PathVariable UUID id,
            @Valid @RequestBody SampleRejectRequest request) {
        mltTestingService.rejectSample(id, request);
        return ResponseEntity.ok().build();
    }
}
