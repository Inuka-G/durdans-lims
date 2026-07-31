package com.uom.lims.dispatch;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.uom.lims.api.dispatch.enums.DispatchItemStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReportDispatchItemRepository
        extends JpaRepository<ReportDispatchItemEntity, UUID>, JpaSpecificationExecutor<ReportDispatchItemEntity> {

    Optional<ReportDispatchItemEntity> findByReportReferenceAndBranchCode(String reportReference, String branchCode);

    Optional<ReportDispatchItemEntity> findFirstByReportReferenceOrderByAuthorizedAtDesc(String reportReference);

    List<ReportDispatchItemEntity> findByReportReferenceIn(Collection<String> reportReferences);

    boolean existsByReportReferenceInAndOverallStatus(Collection<String> reportReferences, DispatchItemStatus status);

    /** Count of dispatch items in the given states — backs the lims_dispatch_failed metric (G2). */
    long countByOverallStatusIn(Collection<DispatchItemStatus> statuses);
}
