package com.uom.lims.repository;

import com.uom.lims.entity.PaymentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * WHY: Manages access to granular payment interactions to enforce correct financial auditing and reversal flows.
 */
@Repository
public interface PaymentRepository extends JpaRepository<PaymentEntity, UUID> {
    List<PaymentEntity> findAllByBillIdAndDeletedFalse(UUID billId);
    List<PaymentEntity> findAllByBillIdAndReversedFalseAndDeletedFalse(UUID billId);
    // WHY: Revenue-today calculation must scope to a time window — loading all payments wastes memory
    // and would incorrectly include historical payments from previous days.
    List<PaymentEntity> findAllByReversedFalseAndPaymentDateBetween(Instant start, Instant end);

    // Branch-scoped via bill -> order (null branch = all, for SUPER_ADMIN).
    @org.springframework.data.jpa.repository.Query("SELECT p FROM PaymentEntity p "
            + "WHERE p.reversed = false AND p.paymentDate BETWEEN :start AND :end "
            + "AND (:branch IS NULL OR p.bill.order.branchCode = :branch)")
    List<PaymentEntity> findReceivedInBranch(
            @org.springframework.data.repository.query.Param("start") Instant start,
            @org.springframework.data.repository.query.Param("end") Instant end,
            @org.springframework.data.repository.query.Param("branch") String branch);
}
