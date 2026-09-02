package com.uom.lims.branch;

import com.uom.lims.api.branch.BranchTestApi;
import com.uom.lims.api.branch.dto.request.BranchTestCreateRequest;
import com.uom.lims.api.branch.dto.request.BranchTestUpdateRequest;
import com.uom.lims.api.branch.dto.response.BranchTestResponse;
import com.uom.lims.api.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** A branch's test catalogue and its pricing — the same admin pair that owns
 *  the branch record and its staff. Matches BranchUserController. */
@RestController
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
public class BranchTestController implements BranchTestApi {

    private final BranchTestService branchTestService;

    @Override
    public PageResponse<BranchTestResponse> getBranchTests(UUID branchId, int page, int size) {
        return branchTestService.getBranchTests(branchId, page, size);
    }

    @Override
    public BranchTestResponse createBranchTest(UUID branchId, BranchTestCreateRequest request) {
        return branchTestService.createBranchTest(branchId, request);
    }

    @Override
    public BranchTestResponse updateBranchTest(UUID branchId, UUID testId, BranchTestUpdateRequest request) {
        return branchTestService.updateBranchTest(branchId, testId, request);
    }
}
