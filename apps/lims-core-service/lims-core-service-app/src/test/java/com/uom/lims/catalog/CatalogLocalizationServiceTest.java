package com.uom.lims.catalog;

import com.uom.lims.api.catalog.dto.response.LocalizedTestResponse;
import com.uom.lims.api.enums.TubeType;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestCatalogI18nEntity;
import com.uom.lims.repository.TestCatalogI18nRepository;
import com.uom.lims.repository.TestPackageI18nRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * The rule these tests exist to protect: a patient is never shown an unreviewed
 * translation of a medical term, and a missing translation falls back to English rather
 * than being invented.
 */
@ExtendWith(MockitoExtension.class)
class CatalogLocalizationServiceTest {

    @Mock
    private TestCatalogI18nRepository testI18nRepository;

    @Mock
    private TestPackageI18nRepository packageI18nRepository;

    private CatalogLocalizationService service;

    private TestCatalogEntity fbc;

    @BeforeEach
    void setUp() {
        service = new CatalogLocalizationService(testI18nRepository, packageI18nRepository);

        fbc = new TestCatalogEntity();
        fbc.setId(UUID.randomUUID());
        fbc.setTestCode("FBC");
        fbc.setTestName("Full Blood Count");
        fbc.setCategory("Hematology");
        fbc.setPrice(new BigDecimal("1200.00"));
        fbc.setSampleType("Whole blood");
        fbc.setTubeType(TubeType.EDTA_PURPLE);
        fbc.setTurnAroundTimeHours(4);
    }

    private TestCatalogI18nEntity translation(String locale, String name, boolean reviewed) {
        TestCatalogI18nEntity t = new TestCatalogI18nEntity();
        t.setTest(fbc);
        t.setLocale(locale);
        t.setTestName(name);
        if (reviewed) {
            t.setReviewedBy("pathologist1");
            t.setReviewedAt(Instant.now());
        }
        return t;
    }

    @Test
    void normalizesWhateverLocaleTagTheCallerPasses() {
        assertThat(service.normalizeLocale("si-LK")).isEqualTo("si");
        assertThat(service.normalizeLocale("SI")).isEqualTo("si");
        assertThat(service.normalizeLocale("ta_IN")).isEqualTo("ta");
        assertThat(service.normalizeLocale("en-GB")).isEqualTo("en");
    }

    /** Never throws: callers pass through a patient's detected language, which is noisy. */
    @Test
    void fallsBackToEnglishForAnythingUnsupported() {
        assertThat(service.normalizeLocale(null)).isEqualTo("en");
        assertThat(service.normalizeLocale("")).isEqualTo("en");
        assertThat(service.normalizeLocale("fr")).isEqualTo("en");
        assertThat(service.normalizeLocale("klingon")).isEqualTo("en");
    }

    @Test
    void usesAReviewedTranslationAndSaysSo() {
        when(testI18nRepository.findReviewedByLocale("si"))
                .thenReturn(List.of(translation("si", "සම්පූර්ණ රුධිර ගණනය", true)));

        List<LocalizedTestResponse> results = service.localizeTests(List.of(fbc), "si");

        assertThat(results).singleElement().satisfies(r -> {
            assertThat(r.testName()).isEqualTo("සම්පූර්ණ රුධිර ගණනය");
            assertThat(r.translated()).isTrue();
            // The English name always travels with it: patients read the abbreviation off
            // the report they are holding.
            assertThat(r.englishName()).isEqualTo("Full Blood Count");
        });
    }

    /**
     * The important one. An unreviewed row is not served — the repository filters it, and
     * the caller gets English with translated=false rather than a machine translation it
     * cannot distinguish from a signed-off one.
     */
    @Test
    void fallsBackToEnglishWhenNoReviewedTranslationExists() {
        when(testI18nRepository.findReviewedByLocale("si")).thenReturn(List.of());

        List<LocalizedTestResponse> results = service.localizeTests(List.of(fbc), "si");

        assertThat(results).singleElement().satisfies(r -> {
            assertThat(r.testName()).isEqualTo("Full Blood Count");
            assertThat(r.translated()).isFalse();
            assertThat(r.locale()).isEqualTo("si");
        });
    }

    @Test
    void doesNotQueryTranslationsForEnglish() {
        Map<UUID, TestCatalogI18nEntity> translations = service.testTranslations("en");

        assertThat(translations).isEmpty();
        org.mockito.Mockito.verify(testI18nRepository, org.mockito.Mockito.never())
                .findReviewedByLocale(anyString());
    }

    @Test
    void carriesPrepFieldsThroughUntouched() {
        fbc.setFastingRequired(true);
        fbc.setFastingHours(12);
        fbc.setWaterAllowed(true);
        when(testI18nRepository.findReviewedByLocale("ta")).thenReturn(List.of());

        assertThat(service.localizeTests(List.of(fbc), "ta")).singleElement().satisfies(r -> {
            assertThat(r.fastingRequired()).isTrue();
            assertThat(r.fastingHours()).isEqualTo(12);
            assertThat(r.waterAllowed()).isTrue();
        });
    }
}
