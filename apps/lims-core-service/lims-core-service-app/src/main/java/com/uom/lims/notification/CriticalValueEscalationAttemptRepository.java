package com.uom.lims.notification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CriticalValueEscalationAttemptRepository
        extends JpaRepository<CriticalValueEscalationAttempt, UUID> {

    List<CriticalValueEscalationAttempt> findByNotificationIdOrderByLevelAsc(UUID notificationId);
}
