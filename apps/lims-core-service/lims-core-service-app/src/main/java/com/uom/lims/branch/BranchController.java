package com.uom.lims.branch;

import com.uom.lims.api.branch.BranchApi;
import com.uom.lims.api.branch.dto.request.BranchCreateRequest;
import com.uom.lims.api.branch.dto.request.BranchUpdateRequest;
import com.uom.lims.api.branch.dto.response.BranchResponse;
import com.uom.lims.api.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class BranchController implements BranchApi {

    private final BranchService branchService;

    @Override
    public BranchResponse createBranch(BranchCreateRequest request) {
        return branchService.createBranch(request);
    }

    @Override
    public BranchResponse getBranchById(UUID id) {
        return branchService.getBranchById(id);
    }

    @Override
    public PageResponse<BranchResponse> getAllBranches(int page, int size) {
        return branchService.getAllBranches(page, size);
    }

    @Override
    public BranchResponse updateBranch(UUID id, BranchUpdateRequest request) {
        return branchService.updateBranch(id, request);
    }
}
