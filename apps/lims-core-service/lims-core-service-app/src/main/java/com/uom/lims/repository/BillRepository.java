package com.uom.lims.repository;

import com.uom.lims.api.enums.PaymentStatus;
import com.uom.lims.entity.BillEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * WHY: Manages the financial aggregations of patients enabling invoice querying and payment state updates.
 */
@Repository
public interface BillRepository extends JpaRepository<BillEntity, UUID> {
    Optional<BillEntity> findByOrderIdAndDeletedFalse(UUID orderId);
    Optional<BillEntity> findByBillNoAndDeletedFalse(String billNo);
    long countByPaymentStatusAndDeletedFalse(PaymentStatus status);
    Page<BillEntity> findAllByPaymentStatusAndDeletedFalse(PaymentStatus status, Pageable pageable);
    Page<BillEntity> findAllByDeletedFalse(Pageable pageable);

    // Branch-scoped via the owning order (null branch = all, for SUPER_ADMIN).
    @org.springframework.data.jpa.repository.Query("SELECT b FROM BillEntity b "
            + "WHERE b.paymentStatus = :status AND b.deleted = false "
            + "AND (:branch IS NULL OR b.order.branchCode = :branch)")
    java.util.List<BillEntity> findByPaymentStatusInBranch(
            @org.springframework.data.repository.query.Param("status") PaymentStatus status,
            @org.springframework.data.repository.query.Param("branch") String branch);
}

