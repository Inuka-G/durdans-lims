package com.uom.lims.catalog;

import com.uom.lims.api.catalog.dto.request.TestPackageUpsertRequest;
import com.uom.lims.api.catalog.dto.response.TestPackageResponse;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestPackageEntity;
import com.uom.lims.entity.TestPackageItemEntity;
import com.uom.lims.exception.BusinessRuleException;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.repository.TestCatalogRepository;
import com.uom.lims.repository.TestPackageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * WHY: packages are what patients ask the price of, and until now the catalogue had no
 * way to express one.
 *
 * <p>The rules enforced here all protect the same thing — that a price quoted to a
 * patient is a price the lab will honour:
 *
 * <ul>
 *   <li>A package cannot be activated at zero. Defining one before it is priced is
 *       normal; letting that placeholder reach a patient is not.</li>
 *   <li>Every item must resolve to an active catalogue test. A package containing a
 *       discontinued test would produce an order that cannot be fulfilled.</li>
 *   <li>Deactivating is a soft delete. Packages appear on printed receipts and past
 *       orders; the row has to survive.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TestPackageService {

    private final TestPackageRepository packageRepository;
    private final TestCatalogRepository testCatalogRepository;
    private final CatalogLocalizationService localization;

    public List<TestPackageResponse> listActive(String requestedLocale) {
        String locale = localization.normalizeLocale(requestedLocale);
        return localization.localizePackages(packageRepository.findAllActiveWithItems(), locale);
    }

    public TestPackageResponse getByCode(String packageCode, String requestedLocale) {
        String locale = localization.normalizeLocale(requestedLocale);
        TestPackageEntity pkg = packageRepository.findByPackageCodeWithItems(packageCode)
                .orElseThrow(() -> new ResourceNotFoundException("Package not found: " + packageCode));

        return localization.localizePackage(
                pkg, locale,
                localization.packageTranslations(locale),
                localization.testTranslations(locale));
    }

    @Transactional
    public TestPackageResponse upsert(TestPackageUpsertRequest request) {
        TestPackageEntity pkg = packageRepository
                .findByPackageCodeAndDeletedFalse(request.packageCode())
                .orElseGet(TestPackageEntity::new);

        boolean creating = pkg.getId() == null;
        pkg.setPackageCode(request.packageCode());
        pkg.setPackageName(request.packageName());
        pkg.setCategory(request.category());
        pkg.setDescription(request.description());
        pkg.setPrice(request.price());
        pkg.setActive(request.activeOrFalse());
        pkg.setDeleted(false);

        replaceItems(pkg, request.items());
        guardActivation(pkg);

        TestPackageEntity saved = packageRepository.save(pkg);
        log.info("{} package {} with {} item(s), active={}",
                creating ? "Created" : "Updated",
                saved.getPackageCode(), saved.getItems().size(), saved.isActive());

        String locale = CatalogLocalizationService.DEFAULT_LOCALE;
        return localization.localizePackage(saved, locale,
                localization.packageTranslations(locale),
                localization.testTranslations(locale));
    }

    @Transactional
    public void setActive(String packageCode, boolean active) {
        TestPackageEntity pkg = packageRepository.findByPackageCodeWithItems(packageCode)
                .orElseThrow(() -> new ResourceNotFoundException("Package not found: " + packageCode));
        pkg.setActive(active);
        guardActivation(pkg);
        packageRepository.save(pkg);
        log.info("Package {} set active={}", packageCode, active);
    }

    /**
     * Soft delete. A package that has ever been ordered appears on receipts and in order
     * history, so the row stays and is simply withdrawn from the catalogue.
     */
    @Transactional
    public void delete(String packageCode) {
        TestPackageEntity pkg = packageRepository.findByPackageCodeAndDeletedFalse(packageCode)
                .orElseThrow(() -> new ResourceNotFoundException("Package not found: " + packageCode));
        pkg.setActive(false);
        pkg.setDeleted(true);
        packageRepository.save(pkg);
        log.info("Package {} withdrawn", packageCode);
    }

    private void replaceItems(TestPackageEntity pkg, List<TestPackageUpsertRequest.Item> requested) {
        // orphanRemoval clears the old rows; rebuilding wholesale is simpler and safer
        // than diffing, and a package has at most a few dozen items.
        pkg.getItems().clear();

        int fallbackOrder = 0;
        for (TestPackageUpsertRequest.Item item : requested) {
            TestCatalogEntity test = testCatalogRepository
                    .findByTestCodeAndDeletedFalse(item.testCode())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Unknown test in package: " + item.testCode()));

            if (!test.isActive()) {
                // Fail rather than silently drop it: a package quietly missing a test the
                // patient was told it contained is worse than a rejected edit.
                throw new BusinessRuleException(
                        "Test " + item.testCode() + " is not active and cannot be added to a package");
            }

            TestPackageItemEntity entity = new TestPackageItemEntity();
            entity.setTestPackage(pkg);
            entity.setTest(test);
            entity.setDisplayOrder(item.displayOrder() == null ? fallbackOrder : item.displayOrder());
            pkg.getItems().add(entity);
            fallbackOrder++;
        }
    }

    /**
     * A package may exist unpriced; it may not be <em>sold</em> unpriced. Seeded sample
     * packages land at zero and inactive for exactly this reason, and this is the check
     * that stops one reaching a patient before somebody prices it.
     */
    private void guardActivation(TestPackageEntity pkg) {
        if (pkg.isActive() && (pkg.getPrice() == null || pkg.getPrice().compareTo(BigDecimal.ZERO) <= 0)) {
            throw new BusinessRuleException(
                    "Package " + pkg.getPackageCode() + " cannot be activated with no price set");
        }
        if (pkg.isActive() && pkg.getItems().isEmpty()) {
            throw new BusinessRuleException(
                    "Package " + pkg.getPackageCode() + " cannot be activated with no tests");
        }
    }
}
