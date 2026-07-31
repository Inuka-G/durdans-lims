package com.uom.lims.controller;

import com.uom.lims.api.phlebotomy.PhlebotomyApi;
import com.uom.lims.api.dto.request.SampleCollectRequest;
import com.uom.lims.api.dto.request.SampleRejectRequest;
import com.uom.lims.api.dto.response.ApiResponse;
import com.uom.lims.api.dto.response.CollectionHistoryResponse;
import com.uom.lims.api.dto.response.PhlebotomyStatsResponse;
import com.uom.lims.api.dto.response.SampleResponse;
import com.uom.lims.api.common.PageResponse;
import com.uom.lims.service.SampleService;
import com.uom.lims.service.StatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * WHY: Manages the phlebotomy workstation operations, including collection,
 * rejection management, and history tracking for specimen integrity.
 */
@RestController
@RequiredArgsConstructor
public class PhlebotomyController implements PhlebotomyApi {

    private final SampleService sampleService;
    private final StatisticsService statisticsService;

    @Override
    @PreAuthorize("hasAnyRole('PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','FRONT_DESK')")
    public ResponseEntity<ApiResponse<PhlebotomyStatsResponse>> getPhlebotomyStats() {
        return ResponseEntity.ok(ApiResponse.success(statisticsService.getPhlebotomyStats()));
    }

    @Override
    @PreAuthorize("hasAnyRole('PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','FRONT_DESK')")
    public ResponseEntity<ApiResponse<PageResponse<SampleResponse>>> getPendingSamples(int page, int size) {
        Page<SampleResponse> result = sampleService.getPendingSamples(PageRequest.of(page, size));
        PageResponse<SampleResponse> response = new PageResponse<>(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.isLast()
        );
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Override
    @PreAuthorize("hasAnyRole('PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','FRONT_DESK')")
    public ResponseEntity<ApiResponse<SampleResponse>> collectSample(UUID sampleId, SampleCollectRequest request) {
        return ResponseEntity.ok(ApiResponse.success(sampleService.collectSample(sampleId, request)));
    }

    @Override
    @PreAuthorize("hasAnyRole('PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','FRONT_DESK')")
    public ResponseEntity<ApiResponse<SampleResponse>> rejectSample(UUID sampleId, SampleRejectRequest request) {
        return ResponseEntity.ok(ApiResponse.success(sampleService.rejectSample(sampleId, request)));
    }

    @Override
    @PreAuthorize("hasAnyRole('PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','FRONT_DESK')")
    public ResponseEntity<ApiResponse<PageResponse<CollectionHistoryResponse>>> getCollectionHistory(int page, int size) {
        Page<CollectionHistoryResponse> result = sampleService.getCollectionHistory(PageRequest.of(page, size));
        PageResponse<CollectionHistoryResponse> response = new PageResponse<>(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.isLast()
        );
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Override
    @PreAuthorize("hasAnyRole('PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','FRONT_DESK','LAB_RECEPTIONIST','LAB_RECEPTION')")
    public ResponseEntity<ApiResponse<SampleResponse>> getSampleDetail(UUID sampleId) {
        return ResponseEntity.ok(ApiResponse.success(sampleService.getSampleDetail(sampleId)));
    }

    @Override
    @PreAuthorize("hasAnyRole('PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','FRONT_DESK','LAB_RECEPTIONIST','LAB_RECEPTION')")
    public ResponseEntity<ApiResponse<SampleResponse>> recordLabelPrint(UUID sampleId) {
        return ResponseEntity.ok(ApiResponse.success(sampleService.recordLabelPrint(sampleId)));
    }
}
