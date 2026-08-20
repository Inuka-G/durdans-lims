package com.uom.lims.repository;

import com.uom.lims.entity.TestPackageI18nEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TestPackageI18nRepository extends JpaRepository<TestPackageI18nEntity, UUID> {

    /** Reviewed rows only — see {@link TestCatalogI18nRepository#findReviewedByLocale}. */
    @Query("""
            SELECT p FROM TestPackageI18nEntity p
            WHERE p.locale = :locale AND p.reviewedAt IS NOT NULL AND p.deleted = false
            """)
    List<TestPackageI18nEntity> findReviewedByLocale(String locale);

    Optional<TestPackageI18nEntity> findByTestPackageIdAndLocaleAndDeletedFalse(UUID packageId, String locale);

    List<TestPackageI18nEntity> findAllByTestPackageIdAndDeletedFalse(UUID packageId);
}
