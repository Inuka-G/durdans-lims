package com.uom.lims.branch;

import com.uom.lims.api.branch.dto.request.BranchTestCreateRequest;
import com.uom.lims.api.branch.dto.request.BranchTestUpdateRequest;
import com.uom.lims.api.branch.dto.response.BranchTestResponse;
import com.uom.lims.api.common.PageResponse;

import java.util.UUID;

public interface BranchTestService {

    PageResponse<BranchTestResponse> getBranchTests(UUID branchId, int page, int size);

    BranchTestResponse createBranchTest(UUID branchId, BranchTestCreateRequest request);

    BranchTestResponse updateBranchTest(UUID branchId, UUID testId, BranchTestUpdateRequest request);
}
