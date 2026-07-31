package com.uom.lims.notification;

import com.uom.lims.api.enums.CriticalNotificationStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CriticalValueNotificationRepository extends JpaRepository<CriticalValueNotification, UUID> {

    boolean existsByResultIdAndStatusIn(UUID resultId, Collection<CriticalNotificationStatus> statuses);

    List<CriticalValueNotification> findByStatusOrderByRaisedAtAsc(CriticalNotificationStatus status, Pageable pageable);

    /** Notifications that have been notified/escalated, are past their SLA, and not yet acknowledged. */
    List<CriticalValueNotification> findByStatusInAndNextEscalationDueAtBefore(
            Collection<CriticalNotificationStatus> statuses, Instant cutoff, Pageable pageable);

    List<CriticalValueNotification> findByBranchCodeOrderByRaisedAtDesc(String branchCode, Pageable pageable);

    List<CriticalValueNotification> findByStatusInAndBranchCodeOrderByRaisedAtDesc(
            Collection<CriticalNotificationStatus> statuses, String branchCode, Pageable pageable);

    List<CriticalValueNotification> findByStatusInOrderByRaisedAtDesc(
            Collection<CriticalNotificationStatus> statuses, Pageable pageable);

    long countByStatusIn(Collection<CriticalNotificationStatus> statuses);

    /** Open callbacks past their acknowledgment SLA — lims_critical_overdue metric (G2). */
    long countByStatusInAndNextEscalationDueAtBefore(
            Collection<CriticalNotificationStatus> statuses, Instant cutoff);
}
