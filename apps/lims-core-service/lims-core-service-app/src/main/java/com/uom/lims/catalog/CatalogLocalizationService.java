package com.uom.lims.catalog;

import com.uom.lims.api.catalog.dto.response.LocalizedTestResponse;
import com.uom.lims.api.catalog.dto.response.TestPackageResponse;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestCatalogI18nEntity;
import com.uom.lims.entity.TestPackageEntity;
import com.uom.lims.entity.TestPackageI18nEntity;
import com.uom.lims.entity.TestPackageItemEntity;
import com.uom.lims.repository.TestCatalogI18nRepository;
import com.uom.lims.repository.TestPackageI18nRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * WHY: renders catalogue entries in Sinhala, Tamil or English for patient-facing channels.
 *
 * <p>Two rules govern everything here, and both exist because the alternative is a
 * clinical risk rather than a cosmetic one:
 *
 * <ol>
 *   <li><b>Only reviewed translations are served.</b> An unreviewed row is treated as
 *       absent. A machine translation of "Erythrocyte Sedimentation Rate" quoted to a
 *       patient is worse than the English, because nobody downstream can tell it was a
 *       guess.</li>
 *   <li><b>Missing means fall back, never invent.</b> The English name is returned with
 *       {@code translated=false} so the caller knows what it is holding.</li>
 * </ol>
 *
 * <p>Translations are loaded once per request as a map rather than per entry. The
 * catalogue is small and read constantly; an N+1 across several hundred tests on every
 * patient question would be the service's hottest query.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatalogLocalizationService {

    /** The language every fallback lands on, and the only one guaranteed present. */
    public static final String DEFAULT_LOCALE = "en";

    private static final Set<String> SUPPORTED_LOCALES = Set.of("si", "ta", "en");

    private final TestCatalogI18nRepository testI18nRepository;
    private final TestPackageI18nRepository packageI18nRepository;

    /**
     * Normalises anything a caller might pass — {@code si-LK}, {@code SI}, null — to a
     * supported tag, falling back to English. Callers pass through a patient's detected
     * language, so this must never throw.
     */
    public String normalizeLocale(String locale) {
        if (locale == null || locale.isBlank()) {
            return DEFAULT_LOCALE;
        }
        String primary = locale.trim().toLowerCase().split("[-_]")[0];
        return SUPPORTED_LOCALES.contains(primary) ? primary : DEFAULT_LOCALE;
    }

    /** Reviewed translations for a locale, keyed by test id. Empty for English. */
    public Map<UUID, TestCatalogI18nEntity> testTranslations(String locale) {
        if (DEFAULT_LOCALE.equals(locale)) {
            return Map.of();
        }
        return testI18nRepository.findReviewedByLocale(locale).stream()
                .collect(Collectors.toMap(t -> t.getTest().getId(), Function.identity(), (a, b) -> a));
    }

    public Map<UUID, TestPackageI18nEntity> packageTranslations(String locale) {
        if (DEFAULT_LOCALE.equals(locale)) {
            return Map.of();
        }
        return packageI18nRepository.findReviewedByLocale(locale).stream()
                .collect(Collectors.toMap(p -> p.getTestPackage().getId(), Function.identity(), (a, b) -> a));
    }

    public LocalizedTestResponse localizeTest(
            TestCatalogEntity test, String locale, Map<UUID, TestCatalogI18nEntity> translations) {

        TestCatalogI18nEntity translation = translations.get(test.getId());
        boolean translated = translation != null;

        return new LocalizedTestResponse(
                test.getId(),
                test.getTestCode(),
                translated ? translation.getTestName() : test.getTestName(),
                test.getTestName(),
                translated ? translation.getColloquialName() : null,
                test.getCategory(),
                test.getPrice(),
                test.getSampleType(),
                test.getTurnAroundTimeHours(),
                test.isFastingRequired(),
                test.getFastingHours(),
                test.isWaterAllowed(),
                test.isSpecialPrepRequired(),
                translated ? translation.getPrepInstruction() : null,
                locale,
                translated);
    }

    public List<LocalizedTestResponse> localizeTests(List<TestCatalogEntity> tests, String locale) {
        Map<UUID, TestCatalogI18nEntity> translations = testTranslations(locale);
        return tests.stream().map(t -> localizeTest(t, locale, translations)).toList();
    }

    public TestPackageResponse localizePackage(
            TestPackageEntity pkg,
            String locale,
            Map<UUID, TestPackageI18nEntity> packageTranslations,
            Map<UUID, TestCatalogI18nEntity> testTranslations) {

        TestPackageI18nEntity translation = packageTranslations.get(pkg.getId());
        boolean translated = translation != null;

        List<LocalizedTestResponse> items = pkg.getItems().stream()
                .map(TestPackageItemEntity::getTest)
                .filter(Objects::nonNull)
                .map(t -> localizeTest(t, locale, testTranslations))
                .toList();

        return new TestPackageResponse(
                pkg.getId(),
                pkg.getPackageCode(),
                translated ? translation.getPackageName() : pkg.getPackageName(),
                pkg.getPackageName(),
                pkg.getCategory(),
                translated ? translation.getDescription() : pkg.getDescription(),
                pkg.getPrice(),
                pkg.individualTotal(),
                pkg.saving(),
                pkg.turnAroundTimeHours(),
                pkg.fastingRequired(),
                pkg.fastingHours(),
                pkg.isActive(),
                items,
                locale,
                translated);
    }

    public List<TestPackageResponse> localizePackages(List<TestPackageEntity> packages, String locale) {
        Map<UUID, TestPackageI18nEntity> packageTranslations = packageTranslations(locale);
        Map<UUID, TestCatalogI18nEntity> testTranslations = testTranslations(locale);
        return packages.stream()
                .map(p -> localizePackage(p, locale, packageTranslations, testTranslations))
                .toList();
    }
}
