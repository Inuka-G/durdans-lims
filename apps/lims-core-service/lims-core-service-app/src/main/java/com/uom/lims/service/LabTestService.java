package com.uom.lims.service;

import com.uom.lims.api.dto.response.LabTestResponse;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.repository.TestCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * WHY: The receptionist needs to see the full active test catalog when creating an order.
 * Centralising catalog access here means any future filtering rules (branch-specific tests,
 * restricted panels) can be added in one place without touching the controller or DTO layers.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LabTestService {

    private final TestCatalogRepository testCatalogRepository;

    /**
     * WHY: Returns only active, non-deleted tests so discontinued panels are never
     * selectable during order creation — preventing orphan order items with no valid catalog entry.
     *
     * @return list of all active lab tests in the catalog
     */
    public List<LabTestResponse> getAllActiveTests() {
        return testCatalogRepository.findAllByActiveTrueAndDeletedFalse().stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * WHY: Isolates entity-to-DTO mapping in a single private method so that
     * any field additions to LabTestResponse only require changes here, not
     * scattered across multiple service methods.
     *
     * @param entity the TestCatalogEntity to convert
     * @return LabTestResponse DTO safe for exposure outside the service layer
     */
    private LabTestResponse toResponse(TestCatalogEntity entity) {
        return LabTestResponse.builder()
                .id(entity.getId().toString())
                .testCode(entity.getTestCode())
                .testName(entity.getTestName())
                .category(entity.getCategory())
                .price(entity.getPrice())
                .sampleType(entity.getSampleType())
                .tubeType(entity.getTubeType().name())
                .turnAroundTimeHours(entity.getTurnAroundTimeHours())
                .build();
    }
}
