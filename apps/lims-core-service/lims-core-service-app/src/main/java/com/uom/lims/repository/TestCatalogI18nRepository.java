package com.uom.lims.repository;

import com.uom.lims.entity.TestCatalogI18nEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TestCatalogI18nRepository extends JpaRepository<TestCatalogI18nEntity, UUID> {

    /**
     * Only reviewed rows. An unreviewed translation of a medical term is worse than no
     * translation, because the caller cannot tell it apart from a signed-off one — so it
     * is filtered here, once, rather than in each caller.
     */
    @Query("""
            SELECT t FROM TestCatalogI18nEntity t
            WHERE t.locale = :locale AND t.reviewedAt IS NOT NULL AND t.deleted = false
            """)
    List<TestCatalogI18nEntity> findReviewedByLocale(String locale);

    Optional<TestCatalogI18nEntity> findByTestIdAndLocaleAndDeletedFalse(UUID testId, String locale);

    /**
     * Every row for a locale, reviewed or not. The coverage report needs drafts as well
     * as published rows, and asking per test would be one query per catalogue entry on
     * an endpoint the project is meant to check daily.
     */
    List<TestCatalogI18nEntity> findAllByLocaleAndDeletedFalse(String locale);

    /** Every row for a test, reviewed or not — the admin screen has to see the drafts. */
    List<TestCatalogI18nEntity> findAllByTestIdAndDeletedFalse(UUID testId);

    @Query("""
            SELECT t.locale, COUNT(t) FROM TestCatalogI18nEntity t
            WHERE t.reviewedAt IS NOT NULL AND t.deleted = false
            GROUP BY t.locale
            """)
    List<Object[]> countReviewedByLocale();
}
