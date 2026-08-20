package com.uom.lims.catalog;

import com.uom.lims.api.catalog.dto.response.LocalizedTestResponse;
import com.uom.lims.api.catalog.dto.response.TestPackageResponse;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestCatalogI18nEntity;
import com.uom.lims.repository.TestCatalogI18nRepository;
import com.uom.lims.repository.TestCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * WHY: the read surface the WhatsApp agent is allowed to call. Catalogue only — no
 * patient data reaches this service, by design.
 *
 * <p>Search runs in memory over the active catalogue rather than as a database query.
 * That is a deliberate choice, not a shortcut: the catalogue is a few hundred rows, it
 * is read on nearly every patient turn, and matching has to span the English name, the
 * code, the Sinhala or Tamil name and the colloquial name at once. A SQL LIKE across
 * four columns in three scripts would be slower to run and far harder to reason about
 * than sorting a small list by how well it matched.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AgentCatalogService {

    /** Enough for a WhatsApp list message, which Meta caps at ten rows anyway. */
    private static final int MAX_RESULTS = 10;

    private final TestCatalogRepository testCatalogRepository;
    private final TestCatalogI18nRepository testI18nRepository;
    private final TestPackageService packageService;
    private final CatalogLocalizationService localization;

    /**
     * Tests matching a patient's words, best match first.
     *
     * <p>An empty query returns the catalogue rather than nothing — "what tests do you
     * do?" is a real question, and an empty list would read as a broken bot.
     */
    public List<LocalizedTestResponse> searchTests(String query, String requestedLocale) {
        String locale = localization.normalizeLocale(requestedLocale);
        Map<UUID, TestCatalogI18nEntity> translations = localization.testTranslations(locale);
        List<TestCatalogEntity> active = testCatalogRepository.findAllByActiveTrueAndDeletedFalse();

        if (query == null || query.isBlank()) {
            return active.stream()
                    .sorted(Comparator.comparing(TestCatalogEntity::getTestName))
                    .limit(MAX_RESULTS)
                    .map(t -> localization.localizeTest(t, locale, translations))
                    .toList();
        }

        String needle = query.trim().toLowerCase(Locale.ROOT);

        return active.stream()
                .map(t -> Map.entry(t, score(t, translations.get(t.getId()), needle)))
                .filter(e -> e.getValue() > 0)
                .sorted(Map.Entry.<TestCatalogEntity, Integer>comparingByValue().reversed()
                        .thenComparing(e -> e.getKey().getTestName()))
                .limit(MAX_RESULTS)
                .map(e -> localization.localizeTest(e.getKey(), locale, translations))
                .toList();
    }

    /**
     * Ranks a candidate against the patient's words. An exact code match outranks
     * everything — a patient who types "FBC" means FBC, and burying it under a
     * substring match on some other test's description would be a bad answer to a
     * perfectly precise question.
     */
    private int score(TestCatalogEntity test, TestCatalogI18nEntity translation, String needle) {
        String code = safeLower(test.getTestCode());
        if (code.equals(needle)) {
            return 100;
        }
        int best = 0;
        if (code.contains(needle)) {
            best = Math.max(best, 60);
        }
        if (safeLower(test.getTestName()).contains(needle)) {
            best = Math.max(best, 50);
        }
        if (safeLower(test.getCategory()).contains(needle)) {
            best = Math.max(best, 20);
        }
        if (translation != null) {
            // A localized or colloquial hit ranks above the English name: if the patient
            // is writing Sinhala, the Sinhala match is the more informative signal.
            if (safeLower(translation.getTestName()).contains(needle)) {
                best = Math.max(best, 70);
            }
            if (safeLower(translation.getColloquialName()).contains(needle)) {
                best = Math.max(best, 65);
            }
        }
        return best;
    }

    private static String safeLower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    public List<TestPackageResponse> listPackages(String requestedLocale) {
        return packageService.listActive(requestedLocale);
    }

    public TestPackageResponse getPackage(String packageCode, String requestedLocale) {
        return packageService.getByCode(packageCode, requestedLocale);
    }

    /**
     * The vocabulary the voice model is primed with so it resolves a half-heard test name
     * against the real catalogue instead of a plausible-sounding neighbour. Includes the
     * code, the English name and — where reviewed — the localized and colloquial forms.
     */
    public List<String> vocabulary(String requestedLocale) {
        String locale = localization.normalizeLocale(requestedLocale);
        Map<UUID, TestCatalogI18nEntity> translations = localization.testTranslations(locale);

        return testCatalogRepository.findAllByActiveTrueAndDeletedFalse().stream()
                .flatMap(t -> {
                    TestCatalogI18nEntity tr = translations.get(t.getId());
                    return java.util.stream.Stream.of(
                                    t.getTestCode(),
                                    t.getTestName(),
                                    tr == null ? null : tr.getTestName(),
                                    tr == null ? null : tr.getColloquialName())
                            .filter(v -> v != null && !v.isBlank());
                })
                .distinct()
                .collect(Collectors.toList());
    }
}
