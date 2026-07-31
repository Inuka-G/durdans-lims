package com.uom.lims.repository;

import com.uom.lims.entity.TestCatalogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * WHY: Enables retrieval of central test catalog records to render order forms and validate test IDs.
 */
@Repository
public interface TestCatalogRepository extends JpaRepository<TestCatalogEntity, UUID> {
    List<TestCatalogEntity> findAllByActiveTrueAndDeletedFalse();
    Optional<TestCatalogEntity> findByTestCodeAndDeletedFalse(String testCode);
    List<TestCatalogEntity> findAllByIdInAndActiveTrueAndDeletedFalse(List<UUID> ids);
}
