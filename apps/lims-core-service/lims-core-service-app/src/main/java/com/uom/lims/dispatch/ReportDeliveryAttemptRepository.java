package com.uom.lims.dispatch;

import com.uom.lims.api.dispatch.enums.DeliveryAttemptStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReportDeliveryAttemptRepository extends JpaRepository<ReportDeliveryAttemptEntity, UUID> {

    List<ReportDeliveryAttemptEntity> findByDispatchItemIdOrderByCreatedAtAsc(UUID dispatchItemId);

    @Query("""
            select a from ReportDeliveryAttemptEntity a
            join fetch a.dispatchItem i
            where a.status = :status
            and (:branch is null or i.branchCode = :branch)
            order by coalesce(a.lastModifiedAt, a.createdAt) desc
            """)
    List<ReportDeliveryAttemptEntity> findRecentByStatusAndBranch(
            @Param("status") DeliveryAttemptStatus status,
            @Param("branch") String branchCode);

    @Query("select a from ReportDeliveryAttemptEntity a join fetch a.dispatchItem i where a.id = :id")
    Optional<ReportDeliveryAttemptEntity> findByIdWithItem(@Param("id") UUID id);
}
