package com.uom.lims.service;

import com.uom.lims.api.dto.request.SupplyCreateRequest;
import com.uom.lims.api.dto.request.SupplyPatchRequest;
import com.uom.lims.api.dto.response.SupplyResponse;
import com.uom.lims.entity.SupplyEntity;
import com.uom.lims.exception.BusinessValidationException;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.repository.SupplyRepository;
import com.uom.lims.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class SupplyService {

    private static final ZoneId BRANCH_ZONE = ZoneId.of("Asia/Colombo");

    private final SupplyRepository supplyRepository;

    @Transactional(readOnly = true)
    public List<SupplyResponse> listSupplies() {
        return supplyRepository.findAllByDeletedFalseOrderByItemNoAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    public SupplyResponse createSupply(SupplyCreateRequest request) {
        String itemNo = request.getItemNo().trim();
        String name = request.getName().trim();

        if (supplyRepository.existsByItemNoIgnoreCaseAndDeletedFalse(itemNo)) {
            throw new BusinessValidationException("An inventory item with item number " + itemNo + " already exists.");
        }
        if (supplyRepository.existsByNameIgnoreCaseAndDeletedFalse(name)) {
            throw new BusinessValidationException("An inventory item with this name already exists.");
        }
        if (request.getMaxStock() < request.getMinStock()) {
            throw new BusinessValidationException("Max stock must be greater than or equal to min stock.");
        }

        SupplyEntity entity = new SupplyEntity();
        entity.setItemNo(itemNo);
        entity.setName(name);
        entity.setCategory(request.getCategory().trim());
        entity.setTubeColor(trimOrNull(request.getTubeColor()));
        entity.setCurrentStock(request.getCurrentStock());
        entity.setMinStock(request.getMinStock());
        entity.setMaxStock(request.getMaxStock());
        entity.setUnit(request.getUnit().trim());
        entity.setLastRestocked(parseLocalDateOrToday(request.getLastRestocked()));
        entity.setCreatedBy(SecurityUtils.getCurrentUsername());

        SupplyEntity saved = supplyRepository.save(entity);
        return toResponse(saved);
    }

    public SupplyResponse patchSupply(UUID id, SupplyPatchRequest request) {
        SupplyEntity entity = supplyRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supply not found with id: " + id));

        if (request.getName() != null && !request.getName().isBlank()) {
            String nextName = request.getName().trim();
            if (!nextName.equalsIgnoreCase(entity.getName())
                    && supplyRepository.existsByNameIgnoreCaseAndDeletedFalse(nextName)) {
                throw new BusinessValidationException("An inventory item with this name already exists.");
            }
            entity.setName(nextName);
        }
        if (request.getCategory() != null && !request.getCategory().isBlank()) {
            entity.setCategory(request.getCategory().trim());
        }
        if (request.getTubeColor() != null) {
            entity.setTubeColor(trimOrNull(request.getTubeColor()));
        }
        if (request.getCurrentStock() != null) {
            entity.setCurrentStock(request.getCurrentStock());
        }
        if (request.getMinStock() != null) {
            entity.setMinStock(request.getMinStock());
        }
        if (request.getMaxStock() != null) {
            entity.setMaxStock(request.getMaxStock());
        }
        if (request.getUnit() != null && !request.getUnit().isBlank()) {
            entity.setUnit(request.getUnit().trim());
        }
        if (request.getLastRestocked() != null && !request.getLastRestocked().isBlank()) {
            entity.setLastRestocked(parseLocalDateOrToday(request.getLastRestocked()));
        }

        if (entity.getMaxStock() < entity.getMinStock()) {
            throw new BusinessValidationException("Max stock must be greater than or equal to min stock.");
        }

        SupplyEntity saved = supplyRepository.save(entity);
        return toResponse(saved);
    }

    public void softDeleteSupply(UUID id) {
        SupplyEntity entity = supplyRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supply not found with id: " + id));
        entity.setDeleted(true);
        supplyRepository.save(entity);
    }

    private SupplyResponse toResponse(SupplyEntity entity) {
        return SupplyResponse.builder()
                .id(entity.getId())
                .itemNo(entity.getItemNo())
                .name(entity.getName())
                .category(entity.getCategory())
                .tubeColor(entity.getTubeColor())
                .currentStock(entity.getCurrentStock())
                .minStock(entity.getMinStock())
                .maxStock(entity.getMaxStock())
                .unit(entity.getUnit())
                .lastRestocked(entity.getLastRestocked())
                .build();
    }

    private static String trimOrNull(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }

    private LocalDate parseLocalDateOrToday(String raw) {
        if (raw == null || raw.isBlank()) {
            return LocalDate.now(BRANCH_ZONE);
        }
        String head = raw.length() >= 10 ? raw.substring(0, 10) : raw;
        return LocalDate.parse(head);
    }
}
