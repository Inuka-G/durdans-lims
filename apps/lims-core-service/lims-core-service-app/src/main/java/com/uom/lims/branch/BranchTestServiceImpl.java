package com.uom.lims.branch;

import com.uom.lims.api.branch.dto.request.BranchTestCreateRequest;
import com.uom.lims.api.branch.dto.request.BranchTestUpdateRequest;
import com.uom.lims.api.branch.dto.response.BranchTestResponse;
import com.uom.lims.api.common.PageResponse;
import com.uom.lims.entity.BranchEntity;
import com.uom.lims.entity.BranchTestEntity;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.metadata.BranchRepository;
import com.uom.lims.repository.BranchTestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BranchTestServiceImpl implements BranchTestService {

    private final BranchTestRepository branchTestRepository;
    private final BranchRepository branchRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<BranchTestResponse> getBranchTests(UUID branchId, int page, int size) {
        // Find branch
        branchRepository.findById(branchId)
                .orElseThrow(() -> new ResourceNotFoundException("Branch not found with id " + branchId));

        // For simplicity, returning all tests for the branch without DB pagination (since UI expects size=100)
        List<BranchTestEntity> entities = branchTestRepository.findByBranchId(branchId);
        
        List<BranchTestResponse> content = entities.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());

        return PageResponse.<BranchTestResponse>builder()
                .content(content)
                .page(0)
                .size(content.size() > 0 ? content.size() : 100)
                .totalElements(content.size())
                .totalPages(1)
                .last(true)
                .build();
    }

    @Override
    @Transactional
    public BranchTestResponse createBranchTest(UUID branchId, BranchTestCreateRequest request) {
        BranchEntity branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new ResourceNotFoundException("Branch not found with id " + branchId));

        BranchTestEntity entity = new BranchTestEntity();
        entity.setBranch(branch);
        entity.setTestName(request.getTestName());
        entity.setTestCode(request.getTestCode());
        entity.setCategory(request.getCategory());
        entity.setPrice(request.getPrice());
        entity.setTurnaroundTime(request.getTurnaroundTime());
        entity.setUnit(request.getUnit());
        entity.setReferenceRange(request.getReferenceRange());
        entity.setActive(request.isActive());

        BranchTestEntity saved = branchTestRepository.save(entity);
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public BranchTestResponse updateBranchTest(UUID branchId, UUID testId, BranchTestUpdateRequest request) {
        branchRepository.findById(branchId)
                .orElseThrow(() -> new ResourceNotFoundException("Branch not found with id " + branchId));

        BranchTestEntity entity = branchTestRepository.findById(testId)
                .orElseThrow(() -> new ResourceNotFoundException("Branch test not found with id " + testId));

        if (!entity.getBranch().getId().equals(branchId)) {
            throw new IllegalArgumentException("Test does not belong to branch");
        }

        if (request.getTestName() != null) entity.setTestName(request.getTestName());
        if (request.getTestCode() != null) entity.setTestCode(request.getTestCode());
        if (request.getCategory() != null) entity.setCategory(request.getCategory());
        if (request.getPrice() != null) entity.setPrice(request.getPrice());
        if (request.getTurnaroundTime() != null) entity.setTurnaroundTime(request.getTurnaroundTime());
        if (request.getUnit() != null) entity.setUnit(request.getUnit());
        if (request.getReferenceRange() != null) entity.setReferenceRange(request.getReferenceRange());
        if (request.getActive() != null) entity.setActive(request.getActive());

        BranchTestEntity saved = branchTestRepository.save(entity);
        return mapToResponse(saved);
    }

    private BranchTestResponse mapToResponse(BranchTestEntity entity) {
        return BranchTestResponse.builder()
                .id(entity.getId())
                .testName(entity.getTestName())
                .testCode(entity.getTestCode())
                .category(entity.getCategory())
                .price(entity.getPrice())
                .turnaroundTime(entity.getTurnaroundTime())
                .unit(entity.getUnit())
                .referenceRange(entity.getReferenceRange())
                .active(entity.isActive())
                .build();
    }
}
