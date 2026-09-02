package com.uom.lims.branch;

import com.uom.lims.api.dto.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import org.springframework.web.bind.annotation.RequestParam;
import com.uom.lims.service.BranchReportService;
import com.uom.lims.api.dto.response.BranchReportResponse;

/**
 * The branch directory. Any admin role can read it (a BRANCH_ADMIN needs to
 * see their own branch's details); only SUPER_ADMIN can create branches,
 * edit them, or (re)assign a branch's admin — branch admins manage their
 * branch's staff via Global User Control, not the branch record itself.
 */
@RestController
@RequestMapping("/api/v1/branches")
@RequiredArgsConstructor
public class BranchController {

    private final BranchService branchService;
    private final BranchReportService branchReportService;

    @GetMapping("/{code}/reports/dashboard")
    public ResponseEntity<ApiResponse<BranchReportResponse>> getDashboard(
            @PathVariable String code,
            @RequestParam(required = false) Instant startDate,
            @RequestParam(required = false) Instant endDate) {
        
        if (startDate == null) {
            startDate = Instant.now().minus(30, java.time.temporal.ChronoUnit.DAYS);
        }
        if (endDate == null) {
            endDate = Instant.now();
        }
        
        return ResponseEntity.ok(ApiResponse.success(branchReportService.getDashboardReport(code, startDate, endDate)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<BranchService.BranchResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success(branchService.listBranches()));
    }

    @GetMapping("/{code}")
    @PreAuthorize("hasAnyRole('BRANCH_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<BranchService.BranchResponse>> get(@PathVariable String code) {
        return ResponseEntity.ok(ApiResponse.success(branchService.getBranch(code)));
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<BranchService.BranchResponse>> create(
            @RequestBody BranchService.CreateBranchRequest request) {
        return ResponseEntity.ok(ApiResponse.success(branchService.createBranch(request), "Branch created"));
    }

    @PutMapping("/{code}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<BranchService.BranchResponse>> update(
            @PathVariable String code, @RequestBody BranchService.UpdateBranchRequest request) {
        return ResponseEntity.ok(ApiResponse.success(branchService.updateBranch(code, request), "Branch updated"));
    }

    @PutMapping("/{code}/admin")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<BranchService.BranchResponse>> assignAdmin(
            @PathVariable String code, @RequestBody BranchService.AssignBranchAdminRequest request) {
        return ResponseEntity.ok(ApiResponse.success(branchService.assignAdmin(code, request), "Branch admin assigned"));
    }
}
