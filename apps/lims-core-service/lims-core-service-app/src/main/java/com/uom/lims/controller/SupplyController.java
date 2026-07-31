package com.uom.lims.controller;

import com.uom.lims.api.dto.request.SupplyCreateRequest;
import com.uom.lims.api.dto.request.SupplyPatchRequest;
import com.uom.lims.api.dto.response.ApiResponse;
import com.uom.lims.api.dto.response.SupplyResponse;
import com.uom.lims.service.SupplyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/supplies")
@RequiredArgsConstructor
public class SupplyController {

    private final SupplyService supplyService;

    @PreAuthorize("hasAnyRole('PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','FRONT_DESK')")
    @GetMapping
    public ResponseEntity<ApiResponse<List<SupplyResponse>>> listSupplies() {
        return ResponseEntity.ok(ApiResponse.success(supplyService.listSupplies()));
    }

    @PreAuthorize("hasAnyRole('PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','FRONT_DESK')")
    @PostMapping
    public ResponseEntity<ApiResponse<SupplyResponse>> createSupply(@Valid @RequestBody SupplyCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(supplyService.createSupply(request)));
    }

    @PreAuthorize("hasAnyRole('PHLEBOTOMIST','BRANCH_ADMIN','SUPER_ADMIN','FRONT_DESK')")
    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<SupplyResponse>> patchSupply(
            @PathVariable UUID id,
            @Valid @RequestBody SupplyPatchRequest request) {
        return ResponseEntity.ok(ApiResponse.success(supplyService.patchSupply(id, request)));
    }

    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteSupply(@PathVariable UUID id) {
        supplyService.softDeleteSupply(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
