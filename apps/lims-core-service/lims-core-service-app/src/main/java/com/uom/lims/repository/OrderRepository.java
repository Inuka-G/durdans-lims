package com.uom.lims.repository;

import com.uom.lims.api.enums.OrderStatus;
import com.uom.lims.entity.OrderEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * WHY: Provides data access operations for managing patient orders and retrieving aggregated statistics.
 */
@Repository
public interface OrderRepository extends JpaRepository<OrderEntity, UUID>, JpaSpecificationExecutor<OrderEntity> {
    Optional<OrderEntity> findByOrderNoAndDeletedFalse(String orderNo);
    Optional<OrderEntity> findByIdAndDeletedFalse(UUID id);
    Page<OrderEntity> findAllByDeletedFalse(Pageable pageable);
    boolean existsByPatientIdAndStatusInAndDeletedFalse(String patientId, List<OrderStatus> statuses);
    List<OrderEntity> findAllByPatientIdAndStatusInAndDeletedFalse(String patientId, List<OrderStatus> statuses);
    Page<OrderEntity> findAllByPatientIdAndDeletedFalse(String patientId, Pageable pageable);
    long countByCreatedAtBetweenAndDeletedFalse(Instant start, Instant end);
    long countByPatientIdAndDeletedFalse(String patientId);

    // Branch-scoped (null branch = all, for SUPER_ADMIN).
    @org.springframework.data.jpa.repository.Query("SELECT count(o) FROM OrderEntity o "
            + "WHERE o.createdAt BETWEEN :start AND :end AND o.deleted = false "
            + "AND (:branch IS NULL OR o.branchCode = :branch)")
    long countCreatedBetweenInBranch(@org.springframework.data.repository.query.Param("start") Instant start,
                                     @org.springframework.data.repository.query.Param("end") Instant end,
                                     @org.springframework.data.repository.query.Param("branch") String branch);
}
