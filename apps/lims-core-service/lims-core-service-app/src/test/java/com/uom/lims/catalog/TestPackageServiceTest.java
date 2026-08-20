package com.uom.lims.catalog;

import com.uom.lims.api.catalog.dto.request.TestPackageUpsertRequest;
import com.uom.lims.api.enums.TubeType;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestPackageEntity;
import com.uom.lims.exception.BusinessRuleException;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.repository.TestCatalogRepository;
import com.uom.lims.repository.TestPackageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Everything guarded here protects one thing: that a price quoted to a patient is a price
 * the lab will actually honour.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TestPackageServiceTest {

    @Mock
    private TestPackageRepository packageRepository;

    @Mock
    private TestCatalogRepository testCatalogRepository;

    @Mock
    private CatalogLocalizationService localization;

    private TestPackageService service;

    @BeforeEach
    void setUp() {
        service = new TestPackageService(packageRepository, testCatalogRepository, localization);
        lenient().when(localization.normalizeLocale(anyString())).thenReturn("en");
        lenient().when(localization.packageTranslations(anyString())).thenReturn(Map.of());
        lenient().when(localization.testTranslations(anyString())).thenReturn(Map.of());
        lenient().when(packageRepository.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private TestCatalogEntity activeTest(String code, String price) {
        TestCatalogEntity t = new TestCatalogEntity();
        t.setId(UUID.randomUUID());
        t.setTestCode(code);
        t.setTestName(code);
        t.setCategory("Biochemistry");
        t.setPrice(new BigDecimal(price));
        t.setSampleType("Serum");
        t.setTubeType(TubeType.SST_GOLD);
        t.setActive(true);
        when(testCatalogRepository.findByTestCodeAndDeletedFalse(code)).thenReturn(Optional.of(t));
        return t;
    }

    private static TestPackageUpsertRequest request(String price, Boolean active, String... testCodes) {
        List<TestPackageUpsertRequest.Item> items = new java.util.ArrayList<>();
        int order = 0;
        for (String code : testCodes) {
            items.add(new TestPackageUpsertRequest.Item(code, order++));
        }
        return new TestPackageUpsertRequest("PKG-DIAB", "Diabetic Package", "Screening",
                null, new BigDecimal(price), active, items);
    }

    @Test
    void createsAPackageWithItsItems() {
        activeTest("GLU", "900.00");
        activeTest("HBA1C", "2600.00");
        when(packageRepository.findByPackageCodeAndDeletedFalse("PKG-DIAB")).thenReturn(Optional.empty());

        service.upsert(request("3000.00", true, "GLU", "HBA1C"));

        verify(packageRepository).save(any(TestPackageEntity.class));
    }

    /**
     * The guard that matters most. Sample packages are seeded at zero and inactive; this
     * is what stops one of those placeholders reaching a patient before somebody prices it.
     */
    @Test
    void refusesToActivateAPackageWithNoPrice() {
        activeTest("GLU", "900.00");
        when(packageRepository.findByPackageCodeAndDeletedFalse("PKG-DIAB")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.upsert(request("0.00", true, "GLU")))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("cannot be activated with no price");

        verify(packageRepository, never()).save(any());
    }

    /** Defining an unpriced package is fine — selling one is not. */
    @Test
    void allowsAnInactivePackageWithNoPrice() {
        activeTest("GLU", "900.00");
        when(packageRepository.findByPackageCodeAndDeletedFalse("PKG-DIAB")).thenReturn(Optional.empty());

        service.upsert(request("0.00", false, "GLU"));

        verify(packageRepository).save(any(TestPackageEntity.class));
    }

    @Test
    void rejectsAnUnknownTestCode() {
        when(packageRepository.findByPackageCodeAndDeletedFalse("PKG-DIAB")).thenReturn(Optional.empty());
        when(testCatalogRepository.findByTestCodeAndDeletedFalse("NOPE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.upsert(request("3000.00", true, "NOPE")))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("NOPE");
    }

    /**
     * Fails rather than silently dropping the test. A package quietly missing something
     * the patient was told it contained is worse than a rejected edit.
     */
    @Test
    void rejectsADiscontinuedTest() {
        TestCatalogEntity retired = activeTest("OLD", "500.00");
        retired.setActive(false);
        when(packageRepository.findByPackageCodeAndDeletedFalse("PKG-DIAB")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.upsert(request("3000.00", true, "OLD")))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("not active");
    }

    @Test
    void replacesItemsWholesaleOnUpdate() {
        activeTest("GLU", "900.00");
        activeTest("HBA1C", "2600.00");
        activeTest("LIPID", "3200.00");

        TestPackageEntity existing = new TestPackageEntity();
        existing.setId(UUID.randomUUID());
        existing.setPackageCode("PKG-DIAB");
        existing.setPrice(new BigDecimal("3000.00"));
        when(packageRepository.findByPackageCodeAndDeletedFalse("PKG-DIAB")).thenReturn(Optional.of(existing));

        service.upsert(request("3000.00", true, "GLU", "HBA1C"));
        assertThat(existing.getItems()).hasSize(2);

        service.upsert(request("3500.00", true, "LIPID"));
        assertThat(existing.getItems()).hasSize(1);
        assertThat(existing.getItems().get(0).getTest().getTestCode()).isEqualTo("LIPID");
    }

    @Test
    void withdrawingAPackageDeactivatesRatherThanRemovesIt() {
        TestPackageEntity existing = new TestPackageEntity();
        existing.setId(UUID.randomUUID());
        existing.setPackageCode("PKG-DIAB");
        existing.setActive(true);
        when(packageRepository.findByPackageCodeAndDeletedFalse("PKG-DIAB")).thenReturn(Optional.of(existing));

        service.delete("PKG-DIAB");

        // The row survives: past orders and printed receipts reference it.
        assertThat(existing.isDeleted()).isTrue();
        assertThat(existing.isActive()).isFalse();
        verify(packageRepository).save(existing);
        verify(packageRepository, never()).delete(any());
    }
}
