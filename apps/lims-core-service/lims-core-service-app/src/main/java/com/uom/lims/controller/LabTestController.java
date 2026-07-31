package com.uom.lims.controller;

import com.uom.lims.api.catalog.LabTestApi;
import com.uom.lims.api.dto.response.ApiResponse;
import com.uom.lims.api.dto.response.LabTestResponse;
import com.uom.lims.service.LabTestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * WHY: Exposes the laboratory test catalog to administrative and reception staff,
 * enabling clinical test selection during the order creation workflow.
 */
@RestController
@RequiredArgsConstructor
public class LabTestController implements LabTestApi {

    private final LabTestService labTestService;

    @Override
    @PreAuthorize("hasAnyRole('BILLING_OFFICER','LAB_SUPERVISOR','BRANCH_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<LabTestResponse>>> getAllActiveTests() {
        return ResponseEntity.ok(ApiResponse.success(labTestService.getAllActiveTests()));
    }
}
