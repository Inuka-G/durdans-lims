package com.uom.lims.catalog;

import com.uom.lims.api.catalog.dto.request.CatalogTranslationRequest;
import com.uom.lims.api.catalog.dto.response.TranslationCoverageResponse;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestCatalogI18nEntity;
import com.uom.lims.entity.TestPackageEntity;
import com.uom.lims.entity.TestPackageI18nEntity;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.repository.TestCatalogI18nRepository;
import com.uom.lims.repository.TestCatalogRepository;
import com.uom.lims.repository.TestPackageI18nRepository;
import com.uom.lims.repository.TestPackageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * WHY: manages Sinhala and Tamil catalogue translations, and — just as importantly —
 * reports how much of the catalogue is still untranslated.
 *
 * <p>Writing a translation and publishing it are separate operations. The person typing
 * the Sinhala and the clinician confirming it is the correct term for the assay are
 * rarely the same person, and until someone confirms it the agent serves English. That
 * is the difference between a fallback and a guess.
 *
 * <p>The coverage report exists because this content work is the schedule critical path
 * for the patient-facing agent and is the kind of task that stalls invisibly. A number
 * the project can look at daily is what turns "we'll get to the translations" into a
 * tracked deliverable.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatalogTranslationService {

    private final TestCatalogRepository testCatalogRepository;
    private final TestCatalogI18nRepository testI18nRepository;
    private final TestPackageRepository packageRepository;
    private final TestPackageI18nRepository packageI18nRepository;
    private final CatalogLocalizationService localization;

    /**
     * Saves a draft translation for a test. Saving always clears any prior review — an
     * edited translation is a new claim and has to be confirmed again, otherwise a
     * reviewed row could be quietly rewritten after approval.
     */
    @Transactional
    public void saveTestTranslation(String testCode, CatalogTranslationRequest request) {
        TestCatalogEntity test = testCatalogRepository.findByTestCodeAndDeletedFalse(testCode)
                .orElseThrow(() -> new ResourceNotFoundException("Test not found: " + testCode));

        String locale = localization.normalizeLocale(request.locale());

        TestCatalogI18nEntity translation = testI18nRepository
                .findByTestIdAndLocaleAndDeletedFalse(test.getId(), locale)
                .orElseGet(() -> {
                    TestCatalogI18nEntity fresh = new TestCatalogI18nEntity();
                    fresh.setTest(test);
                    fresh.setLocale(locale);
                    return fresh;
                });

        translation.setTestName(request.name());
        translation.setColloquialName(request.colloquialName());
        translation.setPrepInstruction(request.prepInstruction());
        translation.setReviewedBy(null);
        translation.setReviewedAt(null);
        translation.setDeleted(false);

        testI18nRepository.save(translation);
        log.info("Saved unreviewed {} translation for test {}", locale, testCode);
    }

    /** Publishes a translation. Until this runs, callers see the English name. */
    @Transactional
    public void reviewTestTranslation(String testCode, String requestedLocale, String reviewer) {
        TestCatalogEntity test = testCatalogRepository.findByTestCodeAndDeletedFalse(testCode)
                .orElseThrow(() -> new ResourceNotFoundException("Test not found: " + testCode));

        String locale = localization.normalizeLocale(requestedLocale);
        TestCatalogI18nEntity translation = testI18nRepository
                .findByTestIdAndLocaleAndDeletedFalse(test.getId(), locale)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No " + locale + " translation to review for test " + testCode));

        translation.setReviewedBy(reviewer);
        translation.setReviewedAt(Instant.now());
        testI18nRepository.save(translation);
        log.info("{} translation for test {} reviewed by {}", locale, testCode, reviewer);
    }

    @Transactional
    public void savePackageTranslation(String packageCode, CatalogTranslationRequest request) {
        TestPackageEntity pkg = packageRepository.findByPackageCodeAndDeletedFalse(packageCode)
                .orElseThrow(() -> new ResourceNotFoundException("Package not found: " + packageCode));

        String locale = localization.normalizeLocale(request.locale());

        TestPackageI18nEntity translation = packageI18nRepository
                .findByTestPackageIdAndLocaleAndDeletedFalse(pkg.getId(), locale)
                .orElseGet(() -> {
                    TestPackageI18nEntity fresh = new TestPackageI18nEntity();
                    fresh.setTestPackage(pkg);
                    fresh.setLocale(locale);
                    return fresh;
                });

        translation.setPackageName(request.name());
        translation.setDescription(request.description());
        translation.setReviewedBy(null);
        translation.setReviewedAt(null);
        translation.setDeleted(false);

        packageI18nRepository.save(translation);
        log.info("Saved unreviewed {} translation for package {}", locale, packageCode);
    }

    @Transactional
    public void reviewPackageTranslation(String packageCode, String requestedLocale, String reviewer) {
        TestPackageEntity pkg = packageRepository.findByPackageCodeAndDeletedFalse(packageCode)
                .orElseThrow(() -> new ResourceNotFoundException("Package not found: " + packageCode));

        String locale = localization.normalizeLocale(requestedLocale);
        TestPackageI18nEntity translation = packageI18nRepository
                .findByTestPackageIdAndLocaleAndDeletedFalse(pkg.getId(), locale)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No " + locale + " translation to review for package " + packageCode));

        translation.setReviewedBy(reviewer);
        translation.setReviewedAt(Instant.now());
        packageI18nRepository.save(translation);
        log.info("{} translation for package {} reviewed by {}", locale, packageCode, reviewer);
    }

    /**
     * How far the translation effort has actually got, per language, with the outstanding
     * test codes listed so the work can be handed to someone as a list rather than a
     * percentage.
     */
    public TranslationCoverageResponse coverage(String requestedLocale) {
        String locale = localization.normalizeLocale(requestedLocale);
        List<TestCatalogEntity> activeTests = testCatalogRepository.findAllByActiveTrueAndDeletedFalse();

        // One query for every row in this locale, reviewed or not. Splitting it here in
        // memory is what keeps the report from issuing a query per catalogue entry.
        List<TestCatalogI18nEntity> forLocale = testI18nRepository.findAllByLocaleAndDeletedFalse(locale);
        Set<UUID> reviewedIds = forLocale.stream()
                .filter(TestCatalogI18nEntity::isReviewed)
                .map(t -> t.getTest().getId())
                .collect(Collectors.toSet());
        Set<UUID> draftIds = forLocale.stream()
                .filter(t -> !t.isReviewed())
                .map(t -> t.getTest().getId())
                .collect(Collectors.toSet());

        // A draft is a translation somebody has written but nobody has confirmed. It is
        // the interesting number: it is work done that is not yet reaching patients.
        long drafts = activeTests.stream()
                .filter(t -> !reviewedIds.contains(t.getId()))
                .filter(t -> draftIds.contains(t.getId()))
                .count();

        List<String> missing = activeTests.stream()
                .filter(t -> !reviewedIds.contains(t.getId()))
                .map(TestCatalogEntity::getTestCode)
                .sorted()
                .toList();

        int total = activeTests.size();
        long reviewed = total - missing.size();
        int percent = total == 0 ? 100 : (int) Math.round(reviewed * 100.0 / total);

        return new TranslationCoverageResponse(locale, total, reviewed, drafts, percent, missing);
    }
}
