package com.uom.lims.branch;

import com.uom.lims.api.branch.dto.request.BranchCreateRequest;
import com.uom.lims.api.branch.dto.request.BranchUpdateRequest;
import com.uom.lims.api.branch.dto.response.BranchResponse;
import com.uom.lims.api.common.PageResponse;
import com.uom.lims.entity.BranchEntity;
import com.uom.lims.exception.InvalidRequestException;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.metadata.BranchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BranchService {

    private final BranchRepository branchRepository;

    @Transactional
    public BranchResponse createBranch(BranchCreateRequest request) {
        log.info("Creating branch with code: {}", request.getCode());
        
        if (branchRepository.findByCode(request.getCode()).isPresent()) {
            throw new InvalidRequestException("Branch with code " + request.getCode() + " already exists");
        }

        BranchEntity entity = new BranchEntity();
        entity.setCode(request.getCode());
        entity.setName(request.getName());
        entity.setLocation(request.getLocation());
        entity.setContactEmail(request.getContactEmail());
        entity.setContactPhone(request.getContactPhone());
        entity.setStatus(request.getStatus() != null ? request.getStatus() : "Active");

        BranchEntity saved = branchRepository.save(entity);
        return mapToResponse(saved);
    }

    @Transactional
    public BranchResponse updateBranch(UUID id, BranchUpdateRequest request) {
        log.info("Updating branch with id: {}", id);
        
        BranchEntity entity = branchRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Branch not found with id: " + id));

        entity.setName(request.getName());
        if (request.getLocation() != null) entity.setLocation(request.getLocation());
        if (request.getContactEmail() != null) entity.setContactEmail(request.getContactEmail());
        if (request.getContactPhone() != null) entity.setContactPhone(request.getContactPhone());
        if (request.getStatus() != null) entity.setStatus(request.getStatus());

        BranchEntity saved = branchRepository.save(entity);
        return mapToResponse(saved);
    }

    public BranchResponse getBranchById(UUID id) {
        BranchEntity entity = branchRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Branch not found with id: " + id));
        return mapToResponse(entity);
    }

    public PageResponse<BranchResponse> getAllBranches(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<BranchEntity> branchPage = branchRepository.findAll(pageable);
        
        List<BranchResponse> content = branchPage.getContent().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
                
        return new PageResponse<>(
                content,
                branchPage.getNumber(),
                branchPage.getSize(),
                branchPage.getTotalElements(),
                branchPage.getTotalPages(),
                branchPage.isLast()
        );
    }

    private BranchResponse mapToResponse(BranchEntity entity) {
        return BranchResponse.builder()
                .id(entity.getId())
                .code(entity.getCode())
                .name(entity.getName())
                .location(entity.getLocation())
                .contactEmail(entity.getContactEmail())
                .contactPhone(entity.getContactPhone())
                .status(entity.getStatus())
                .build();
    }
}
