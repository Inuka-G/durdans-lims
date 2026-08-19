package com.uom.lims.service;

import com.uom.lims.api.dto.request.SupplyCreateRequest;
import com.uom.lims.api.dto.request.SupplyPatchRequest;
import com.uom.lims.api.dto.response.SupplyResponse;
import com.uom.lims.api.enums.TubeType;
import com.uom.lims.entity.SupplyEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.exception.BusinessValidationException;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.repository.SupplyRepository;
import com.uom.lims.repository.TestCatalogRepository;
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
    private static final String DEFAULT_CATEGORY = "Collection tubes";
    private static final String DEFAULT_UNIT = "tubes";

    private final SupplyRepository supplyRepository;
    private final TestCatalogRepository testCatalogRepository;

    @Transactional(readOnly = true)
    public List<SupplyResponse> listSupplies() {
        return supplyRepository.findAllByDeletedFalseOrderByItemNoAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * WHY: Inventory is counted per tube, not per test, so every item resolves to exactly one
     * tube — given directly or borrowed from the catalog entry of the test it was created for.
     */
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

        TubeType tubeType = resolveTubeType(request.getTubeType(), request.getTestId());

        // WHY: Stock is pooled per tube, so a second row would split one physical box of
        // tubes across two counters and leave both wrong.
        if (supplyRepository.existsByTubeTypeAndDeletedFalse(tubeType)) {
            throw new BusinessValidationException("An inventory item for tube " + tubeType + " already exists.");
        }

        SupplyEntity entity = new SupplyEntity();
        entity.setItemNo(itemNo);
        entity.setName(name);
        entity.setCategory(defaultIfBlank(request.getCategory(), DEFAULT_CATEGORY));
        entity.setTubeType(tubeType);
        entity.setTubeColor(trimOrNull(request.getTubeColor()));
        entity.setCurrentStock(request.getCurrentStock());
        entity.setMinStock(request.getMinStock());
        entity.setMaxStock(request.getMaxStock());
        entity.setUnit(defaultIfBlank(request.getUnit(), DEFAULT_UNIT));
        entity.setLastRestocked(parseLocalDateOrToday(request.getLastRestocked()));
        entity.setCreatedBy(SecurityUtils.getCurrentUsername());

        SupplyEntity saved = supplyRepository.save(entity);
        return toResponse(saved);
    }

    public SupplyResponse patchSupply(UUID id, SupplyPatchRequest request) {
        SupplyEntity entity = supplyRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supply not found with id: " + id));

        // WHY: An absolute stock count is only true of the shelf it was counted against. If a
        // collection or a restock moved the row since the caller read it, writing the count back
        // would silently undo that movement, so the caller may pin the version it counted from.
        if (request.getExpectedVersion() != null && !request.getExpectedVersion().equals(entity.getVersion())) {
            throw new BusinessValidationException(
                    "This inventory item changed since it was loaded. Reload it and try again.");
        }

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
        if (request.getTubeType() != null) {
            TubeType nextTubeType = request.getTubeType();
            boolean stockedElsewhere = supplyRepository.findByTubeTypeAndDeletedFalse(nextTubeType)
                    .filter(other -> !other.getId().equals(entity.getId()))
                    .isPresent();
            if (stockedElsewhere) {
                throw new BusinessValidationException("An inventory item for tube " + nextTubeType + " already exists.");
            }
            entity.setTubeType(nextTubeType);
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

    /**
     * WHY: Separate from patchSupply because the two write stock for opposite reasons.
     * patchSupply sets the number a human counted on the shelf; this applies a movement —
     * a delivery received, a box discarded — and the row it applies to is the one in the
     * database at that instant, not the one the caller last read. Sending the resulting
     * total instead would erase every collection that deducted a tube in between.
     *
     * @param id    the UUID of the inventory item to move stock on
     * @param delta tubes to add, or a negative number to remove
     * @return the item as it stands after the movement, carrying the true new count
     * @throws ResourceNotFoundException   if the item does not exist, including when it is
     *                                     retired between the pre-check and the movement
     * @throws BusinessValidationException if the movement would drive stock below zero
     */
    public SupplyResponse adjustStock(UUID id, int delta) {
        if (!supplyRepository.existsByIdAndDeletedFalse(id)) {
            throw new ResourceNotFoundException("Supply not found with id: " + id);
        }

        if (supplyRepository.adjustStockBy(id, delta) == 0) {
            // WHY: The update matches on the floor guard and on the row still being live, so a
            // zero does not say which of the two failed — and for an addition the floor can
            // never fail. Re-reading tells them apart, so a row retired since the pre-check is
            // reported as missing rather than as a shortage of stock nobody can go and count.
            SupplyEntity current = supplyRepository.findByIdAndDeletedFalse(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Supply not found with id: " + id));
            throw new BusinessValidationException("Cannot remove " + Math.abs(delta)
                    + " from stock: only " + current.getCurrentStock() + " remain.");
        }

        return supplyRepository.findByIdAndDeletedFalse(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Supply not found with id: " + id));
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
                .tubeType(entity.getTubeType())
                .tubeColor(entity.getTubeColor())
                .currentStock(entity.getCurrentStock())
                .minStock(entity.getMinStock())
                .maxStock(entity.getMaxStock())
                .unit(entity.getUnit())
                .lastRestocked(entity.getLastRestocked())
                .version(entity.getVersion())
                .build();
    }

    private TubeType resolveTubeType(TubeType requested, UUID testId) {
        if (requested != null) {
            return requested;
        }
        if (testId != null) {
            TestCatalogEntity test = testCatalogRepository.findById(testId)
                    .filter(catalog -> !catalog.isDeleted())
                    .orElseThrow(() -> new ResourceNotFoundException("Test not found with id: " + testId));
            if (test.getTubeType() != null) {
                return test.getTubeType();
            }
        }
        throw new BusinessValidationException("Tube type is required.");
    }

    private static String trimOrNull(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }

    private static String defaultIfBlank(String raw, String fallback) {
        String trimmed = trimOrNull(raw);
        return trimmed == null ? fallback : trimmed;
    }

    private LocalDate parseLocalDateOrToday(String raw) {
        if (raw == null || raw.isBlank()) {
            return LocalDate.now(BRANCH_ZONE);
        }
        String head = raw.length() >= 10 ? raw.substring(0, 10) : raw;
        return LocalDate.parse(head);
    }
}
