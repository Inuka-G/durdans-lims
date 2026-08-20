package com.uom.lims.repository;

import com.uom.lims.entity.TestPackageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * WHY: package lookup for order creation and for the patient-facing agent.
 *
 * <p>The fetch joins are not an optimisation. A package is meaningless without its items
 * and their prices — every caller computes the saving and the strictest fasting rule from
 * them — so loading it lazily guarantees either an N+1 or a LazyInitializationException
 * outside the transaction.
 */
@Repository
public interface TestPackageRepository extends JpaRepository<TestPackageEntity, UUID> {

    @Query("""
            SELECT DISTINCT p FROM TestPackageEntity p
            LEFT JOIN FETCH p.items i
            LEFT JOIN FETCH i.test
            WHERE p.active = true AND p.deleted = false
            ORDER BY p.packageName
            """)
    List<TestPackageEntity> findAllActiveWithItems();

    @Query("""
            SELECT p FROM TestPackageEntity p
            LEFT JOIN FETCH p.items i
            LEFT JOIN FETCH i.test
            WHERE p.packageCode = :packageCode AND p.deleted = false
            """)
    Optional<TestPackageEntity> findByPackageCodeWithItems(String packageCode);

    Optional<TestPackageEntity> findByPackageCodeAndDeletedFalse(String packageCode);

    boolean existsByPackageCodeAndDeletedFalse(String packageCode);
}
