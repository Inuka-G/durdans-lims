package com.uom.lims.api.branch;

import com.uom.lims.api.branch.dto.request.BranchTestCreateRequest;
import com.uom.lims.api.branch.dto.request.BranchTestUpdateRequest;
import com.uom.lims.api.branch.dto.response.BranchTestResponse;
import com.uom.lims.api.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.UUID;

@RequestMapping("/api/v1/branches/{branchId}/tests")
@Tag(name = "Branch Tests", description = "Endpoints for managing branch-specific tests")
public interface BranchTestApi {

    @Operation(summary = "Get branch tests", description = "Retrieves all tests for a specific branch")
    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    PageResponse<BranchTestResponse> getBranchTests(
            @PathVariable UUID branchId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size
    );

    @Operation(summary = "Create branch test", description = "Creates a new test for a specific branch")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    BranchTestResponse createBranchTest(
            @PathVariable UUID branchId,
            @Valid @RequestBody BranchTestCreateRequest request
    );

    @Operation(summary = "Update branch test", description = "Updates an existing test for a specific branch")
    @PatchMapping("/{testId}")
    @ResponseStatus(HttpStatus.OK)
    BranchTestResponse updateBranchTest(
            @PathVariable UUID branchId,
            @PathVariable UUID testId,
            @Valid @RequestBody BranchTestUpdateRequest request
    );
}
