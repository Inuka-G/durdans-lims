package com.uom.lims.branchuser;

import com.uom.lims.api.branchuser.BranchUserApi;
import com.uom.lims.api.branchuser.dto.request.BranchUserCreateRequest;
import com.uom.lims.api.branchuser.dto.request.BranchUserUpdateRequest;
import com.uom.lims.api.branchuser.dto.response.BranchUserResponse;
import com.uom.lims.api.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1")
public class BranchUserController implements BranchUserApi {

    private final BranchUserService branchUserService;

    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
    @PostMapping("/branches/{branchId}/users")
    @Override
    public BranchUserResponse createBranchUser(@Valid @RequestBody BranchUserCreateRequest request) {
        return branchUserService.createBranchUser(request);
    }

    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping("/branch-users/{id}")
    @Override
    public BranchUserResponse getBranchUserById(@PathVariable String id) {
        return branchUserService.getBranchUserById(id);
    }

    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping("/branches/{branchId}/users")
    @Override
    public PageResponse<BranchUserResponse> searchBranchUsers(
            @PathVariable String branchId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {

        String[] sortParams = sort.split(",");
        String sortField = sortParams[0];
        Sort.Direction direction = sortParams.length > 1 && sortParams[1].equalsIgnoreCase("desc") 
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortField));

        Page<BranchUserResponse> result = branchUserService.searchBranchUsers(branchId, keyword, isActive, pageable);
        
        return PageResponse.<BranchUserResponse>builder()
                .content(result.getContent())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .page(result.getNumber())
                .size(result.getSize())
                .last(result.isLast())
                .build();
    }

    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
    @PutMapping("/branch-users/{id}")
    @Override
    public BranchUserResponse updateBranchUser(
            @PathVariable String id,
            @Valid @RequestBody BranchUserUpdateRequest request) {
        return branchUserService.updateBranchUser(id, request);
    }

    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
    @DeleteMapping("/branch-users/{id}")
    @Override
    public void deleteBranchUser(@PathVariable String id) {
        branchUserService.deleteBranchUser(id);
    }
}
