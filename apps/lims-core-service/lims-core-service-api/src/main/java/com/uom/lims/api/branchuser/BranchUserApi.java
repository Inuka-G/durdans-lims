package com.uom.lims.api.branchuser;

import com.uom.lims.api.branchuser.dto.request.BranchUserCreateRequest;
import com.uom.lims.api.branchuser.dto.request.BranchUserUpdateRequest;
import com.uom.lims.api.branchuser.dto.response.BranchUserResponse;
import com.uom.lims.api.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Branch User Management", description = "APIs for managing branch users")
public interface BranchUserApi {

    @Operation(summary = "Create a new branch user")
    BranchUserResponse createBranchUser(@Valid BranchUserCreateRequest request);

    @Operation(summary = "Get branch user by ID")
    BranchUserResponse getBranchUserById(String id);

    @Operation(summary = "Search branch users")
    PageResponse<BranchUserResponse> searchBranchUsers(
            String branchId,
            String keyword,
            Boolean isActive,
            int page,
            int size,
            String sort);

    @Operation(summary = "Update branch user")
    BranchUserResponse updateBranchUser(String id, @Valid BranchUserUpdateRequest request);

    @Operation(summary = "Delete branch user")
    void deleteBranchUser(String id);

    @Operation(summary = "Reset branch user password")
    void resetBranchUserPassword(String id, @Valid com.uom.lims.api.superadmin.dto.ResetPasswordRequest request);
}
