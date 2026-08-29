package com.uom.lims.api.branch;

import com.uom.lims.api.branch.dto.request.BranchCreateRequest;
import com.uom.lims.api.branch.dto.request.BranchUpdateRequest;
import com.uom.lims.api.branch.dto.response.BranchResponse;
import com.uom.lims.api.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RequestMapping("/api/v1/branches")
@Tag(name = "Branch Management", description = "APIs for managing branches")
public interface BranchApi {

    @PostMapping
    @Operation(summary = "Create a new branch")
    BranchResponse createBranch(@Valid @RequestBody BranchCreateRequest request);

    @GetMapping("/{id}")
    @Operation(summary = "Get branch by ID")
    BranchResponse getBranchById(@PathVariable("id") UUID id);

    @GetMapping
    @Operation(summary = "Get all branches")
    PageResponse<BranchResponse> getAllBranches(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size
    );

    @PutMapping("/{id}")
    @Operation(summary = "Update branch")
    BranchResponse updateBranch(
            @PathVariable("id") UUID id,
            @Valid @RequestBody BranchUpdateRequest request
    );
}
