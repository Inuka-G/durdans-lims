package com.uom.lims.repository;

import com.uom.lims.api.enums.PaymentStatus;
import com.uom.lims.api.enums.Priority;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.entity.SampleEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * WHY: Isolates database access for phlebotomy workflows allowing dynamic
 * queueing and chain-of-custody tracking.
 */
@Repository
public interface SampleRepository extends JpaRepository<SampleEntity, UUID>, JpaSpecificationExecutor<SampleEntity> {
    Optional<SampleEntity> findByBarcodeAndDeletedFalse(String barcode);

    boolean existsByBarcodeAndDeletedFalse(String barcode);

    Page<SampleEntity> findAllByStatusAndDeletedFalse(SampleStatus status, Pageable pageable);

    Page<SampleEntity> findAllByStatusInAndDeletedFalse(List<SampleStatus> statuses, Pageable pageable);

    Page<SampleEntity> findAllByStatusAndOrderItem_Order_Bill_PaymentStatusAndDeletedFalse(
            SampleStatus status, PaymentStatus paymentStatus, Pageable pageable);

    @Query("SELECT s FROM SampleEntity s WHERE s.status IN :statuses AND s.deleted = false "
            + "ORDER BY COALESCE(s.collectedAt, s.rejectedAt, s.createdAt) DESC")
    Page<SampleEntity> findHistoryForStatuses(@Param("statuses") List<SampleStatus> statuses, Pageable pageable);

    // Tenant-scoped variants: branch is reached via orderItem.order.branchCode;
    // a null branch means "all branches" (SUPER_ADMIN only).
    @Query("SELECT s FROM SampleEntity s WHERE s.status IN :statuses AND s.deleted = false "
            + "AND (:branch IS NULL OR s.orderItem.order.branchCode = :branch)")
    Page<SampleEntity> findByStatusInAndBranch(@Param("statuses") List<SampleStatus> statuses,
                                               @Param("branch") String branch, Pageable pageable);

    @Query("SELECT s FROM SampleEntity s WHERE s.status IN :statuses AND s.deleted = false "
            + "AND (:branch IS NULL OR s.orderItem.order.branchCode = :branch) "
            + "ORDER BY COALESCE(s.collectedAt, s.rejectedAt, s.createdAt) DESC")
    Page<SampleEntity> findHistoryForStatusesInBranch(@Param("statuses") List<SampleStatus> statuses,
                                                      @Param("branch") String branch, Pageable pageable);

    @Query("SELECT s FROM SampleEntity s WHERE s.deleted = false "
            + "AND (:branch IS NULL OR s.orderItem.order.branchCode = :branch) "
            + "ORDER BY COALESCE(s.collectedAt, s.rejectedAt, s.createdAt) DESC")
    List<SampleEntity> findAllMltWorklistSamplesInBranch(@Param("branch") String branch);

    @Query("SELECT count(s) FROM SampleEntity s WHERE s.status = :status "
            + "AND s.collectedAt BETWEEN :start AND :end AND s.deleted = false "
            + "AND (:branch IS NULL OR s.orderItem.order.branchCode = :branch)")
    long countByStatusAndCollectedBetweenInBranch(@Param("status") SampleStatus status,
            @Param("start") Instant start, @Param("end") Instant end, @Param("branch") String branch);

    @Query("SELECT count(s) FROM SampleEntity s WHERE s.status = :status AND s.deleted = false "
            + "AND (:branch IS NULL OR s.orderItem.order.branchCode = :branch)")
    long countByStatusInBranch(@Param("status") SampleStatus status, @Param("branch") String branch);

    @Query("SELECT s FROM SampleEntity s WHERE s.status IN :statuses AND s.deleted = false "
            + "AND (:branch IS NULL OR s.orderItem.order.branchCode = :branch)")
    List<SampleEntity> findByStatusInAndBranchList(@Param("statuses") List<SampleStatus> statuses,
            @Param("branch") String branch);

    // MLT worklist by status set, branch-scoped, ordered by collection time.
    @Query("SELECT s FROM SampleEntity s WHERE s.status IN :statuses AND s.deleted = false "
            + "AND (:branch IS NULL OR s.orderItem.order.branchCode = :branch) "
            + "ORDER BY s.collectedAt ASC")
    List<SampleEntity> findByStatusInAndBranchOrderByCollectedAt(@Param("statuses") List<SampleStatus> statuses,
            @Param("branch") String branch);

    long countByStatusAndDeletedFalse(SampleStatus status);

    long countByStatusAndOrderItem_Order_Bill_PaymentStatusAndDeletedFalse(
            SampleStatus status, PaymentStatus paymentStatus);

    long countByStatusAndCollectedAtBetweenAndDeletedFalse(SampleStatus status, Instant start, Instant end);

    // WHY: Urgent count uses a DB-level filter on priority list to avoid loading all pending samples.
    long countByStatusAndPriorityInAndDeletedFalse(SampleStatus status, List<Priority> priorities);

    // WHY: Today's rejection count uses rejectedAt timestamp bounds to scope to current shift/day only.
    long countByStatusAndRejectedAtBetweenAndDeletedFalse(SampleStatus status, Instant start, Instant end);

    List<SampleEntity> findByStatusInAndDeletedFalseOrderByCollectedAtAsc(List<SampleStatus> statuses);

    @Query("SELECT s FROM SampleEntity s WHERE s.deleted = false "
            + "ORDER BY COALESCE(s.collectedAt, s.rejectedAt, s.createdAt) DESC")
    List<SampleEntity> findAllMltWorklistSamples();
}
