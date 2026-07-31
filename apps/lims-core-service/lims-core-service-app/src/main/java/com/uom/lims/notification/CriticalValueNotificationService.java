package com.uom.lims.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.api.critical.dto.request.AcknowledgeCriticalRequest;
import com.uom.lims.api.critical.dto.response.CriticalNotificationResponse;
import com.uom.lims.api.enums.CriticalNotificationStatus;
import com.uom.lims.api.enums.Priority;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.audit.AuditService;
import com.uom.lims.entity.OrderEntity;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.exception.BusinessRuleException;
import com.uom.lims.exception.InvalidRequestException;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Critical-value (panic) callback workflow (H1).
 *
 * <p>{@link #openForResult} runs inside the result-entry / instrument-ingestion
 * transaction so a callback is opened atomically with the critical result (and is
 * de-duplicated — at most one open callback per result). Sending and escalation happen
 * OFF the business transaction (driven by {@code CriticalValueScheduler}); the blocking
 * SMS/email I/O is performed outside any DB transaction and the per-row status update is
 * a short {@code REQUIRES_NEW} transaction, mirroring the outbox/dispatch pattern.
 *
 * <p>Recipient resolution is deliberately fail-safe: a critical value must NEVER be left
 * un-notified, so when the order carries no deliverable clinician contact the callback
 * is routed to a configured on-call lab address.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CriticalValueNotificationService {

    private static final List<CriticalNotificationStatus> OPEN_STATUSES =
            List.of(CriticalNotificationStatus.PENDING,
                    CriticalNotificationStatus.NOTIFIED,
                    CriticalNotificationStatus.ESCALATED);

    private static final String ENTITY_TYPE = "CRITICAL_VALUE";
    private static final String ACTION_RAISED = "CRITICAL_RAISED";
    private static final String ACTION_NOTIFIED = "CRITICAL_NOTIFIED";
    private static final String ACTION_ESCALATED = "CRITICAL_ESCALATED";
    private static final String ACTION_ACKNOWLEDGED = "CRITICAL_ACKNOWLEDGED";
    private static final String ACTION_CLOSED = "CRITICAL_CLOSED";

    private final CriticalValueNotificationRepository notificationRepository;
    private final CriticalValueEscalationAttemptRepository attemptRepository;
    private final AuditService auditService;
    private final EmailService emailService;
    private final SmsService smsService;
    private final ObjectMapper objectMapper;

    @Value("${app.critical.ack-timeout-minutes:15}")
    private long routineTimeoutMinutes;
    @Value("${app.critical.stat-ack-timeout-minutes:5}")
    private long statTimeoutMinutes;
    @Value("${app.critical.max-escalation-levels:3}")
    private int maxEscalationLevels;
    @Value("${app.critical.fallback-contact:lab-oncall@durdans.example}")
    private String fallbackContact;
    @Value("${app.critical.escalation-contact:}")
    private String escalationContact;

    @Autowired
    @Lazy
    private CriticalValueNotificationService self;

    // ---------------------------------------------------------------------
    // Opening (in the business transaction)
    // ---------------------------------------------------------------------

    /**
     * Opens a callback for a freshly produced critical result. No-op when the result is
     * a draft, not critical, or already has an open callback (idempotent).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void openForResult(TestResultEntity result) {
        if (result == null || Boolean.TRUE.equals(result.getDraft())) {
            return;
        }
        ResultFlag flag = result.getFlag();
        if (flag != ResultFlag.CRITICAL_LOW && flag != ResultFlag.CRITICAL_HIGH) {
            return;
        }
        if (notificationRepository.existsByResultIdAndStatusIn(result.getId(), OPEN_STATUSES)) {
            return;
        }

        SampleEntity sample = result.getSample();
        OrderEntity order = sample != null && sample.getOrderItem() != null
                ? sample.getOrderItem().getOrder() : null;
        Priority priority = sample != null ? sample.getPriority() : null;
        String patientCode = order != null ? order.getPatientId() : null;
        String branchCode = order != null ? order.getBranchCode() : null;

        String recipientName = order != null && order.getReferringDoctor() != null
                && !order.getReferringDoctor().isBlank()
                ? order.getReferringDoctor().trim()
                : "Attending clinician (lab on-call)";
        String recipientContact = fallbackContact; // no clinician directory yet — fail safe to on-call lab
        String channel = recipientContact != null && recipientContact.contains("@") ? "EMAIL" : "SMS";

        Instant now = Instant.now();
        CriticalValueNotification n = new CriticalValueNotification();
        n.setResultId(result.getId());
        n.setSampleId(sample != null ? sample.getId() : null);
        n.setParameterId(result.getParameter() != null ? result.getParameter().getId() : null);
        n.setParameterName(result.getParameter() != null ? result.getParameter().getName() : null);
        n.setPatientCode(patientCode);
        n.setBranchCode(branchCode);
        n.setFlag(flag.name());
        n.setResultValue(result.getResultValue());
        n.setPriority(priority != null ? priority.name() : null);
        n.setRecipientName(recipientName);
        n.setRecipientContact(recipientContact);
        n.setChannel(channel);
        n.setStatus(CriticalNotificationStatus.PENDING);
        n.setEscalationLevel(0);
        n.setRaisedAt(now);
        n.setNextEscalationDueAt(now.plus(slaFor(priority)));
        notificationRepository.save(n);

        auditService.log(ACTION_RAISED, ENTITY_TYPE, result.getId(), patientCode,
                payload(n, "Critical value detected"), null, branchCode);
        log.warn("CRITICAL value raised: patient={} {}={} ({}) — callback opened",
                patientCode, n.getParameterName(), n.getResultValue(), n.getFlag());
    }

    // ---------------------------------------------------------------------
    // Delivery + escalation (driven by the scheduler, OFF the business txn)
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<CriticalValueNotification> dueForInitialSend(int limit) {
        return notificationRepository.findByStatusOrderByRaisedAtAsc(
                CriticalNotificationStatus.PENDING, PageRequest.of(0, limit));
    }

    @Transactional(readOnly = true)
    public List<CriticalValueNotification> dueForEscalation(Instant cutoff, int limit) {
        return notificationRepository.findByStatusInAndNextEscalationDueAtBefore(
                List.of(CriticalNotificationStatus.PENDING,
                        CriticalNotificationStatus.NOTIFIED,
                        CriticalNotificationStatus.ESCALATED),
                cutoff, PageRequest.of(0, limit));
    }

    /** Sends the first callout (I/O outside any txn), then records the outcome. */
    public void deliverInitial(CriticalValueNotification n) {
        boolean sent = sendCallout(n, n.getRecipientContact(), n.getChannel());
        self.recordInitialDelivery(n.getId(), sent);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordInitialDelivery(UUID id, boolean sent) {
        CriticalValueNotification n = notificationRepository.findById(id).orElse(null);
        if (n == null || n.getStatus() != CriticalNotificationStatus.PENDING) {
            return; // acknowledged/escalated meanwhile
        }
        recordAttempt(n, n.getEscalationLevel(), n.getRecipientContact(), n.getChannel(), sent);
        if (sent) {
            n.setStatus(CriticalNotificationStatus.NOTIFIED);
            n.setNotifiedAt(Instant.now());
            notificationRepository.save(n);
            auditService.log(ACTION_NOTIFIED, ENTITY_TYPE, n.getResultId(), n.getPatientCode(),
                    payload(n, "Callback delivered"), null, n.getBranchCode());
        }
        // On failure the row stays PENDING; the escalation pass re-attempts after the SLA.
    }

    /** Escalates one overdue, unacknowledged callback to the next tier (I/O then record). */
    public void escalate(CriticalValueNotification n) {
        int nextLevel = n.getEscalationLevel() + 1;
        if (nextLevel > maxEscalationLevels) {
            self.close(n.getId());
            return;
        }
        String contact = escalationContact != null && !escalationContact.isBlank()
                ? escalationContact : n.getRecipientContact();
        String channel = contact != null && contact.contains("@") ? "EMAIL" : "SMS";
        boolean sent = sendCallout(n, contact, channel);
        self.recordEscalation(n.getId(), nextLevel, contact, channel, sent);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordEscalation(UUID id, int level, String contact, String channel, boolean sent) {
        CriticalValueNotification n = notificationRepository.findById(id).orElse(null);
        if (n == null
                || n.getStatus() == CriticalNotificationStatus.ACKNOWLEDGED
                || n.getStatus() == CriticalNotificationStatus.CLOSED) {
            return; // acknowledged/closed meanwhile — never re-escalate
        }
        recordAttempt(n, level, contact, channel, sent);
        n.setEscalationLevel(level);
        n.setStatus(CriticalNotificationStatus.ESCALATED);
        n.setNextEscalationDueAt(Instant.now().plus(slaFor(parsePriority(n.getPriority()))));
        notificationRepository.save(n);
        auditService.log(ACTION_ESCALATED, ENTITY_TYPE, n.getResultId(), n.getPatientCode(),
                payload(n, "Escalated to level " + level), null, n.getBranchCode());
        log.warn("CRITICAL value escalated to level {}: patient={} {}={}",
                level, n.getPatientCode(), n.getParameterName(), n.getResultValue());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void close(UUID id) {
        CriticalValueNotification n = notificationRepository.findById(id).orElse(null);
        if (n == null
                || n.getStatus() == CriticalNotificationStatus.ACKNOWLEDGED
                || n.getStatus() == CriticalNotificationStatus.CLOSED) {
            return;
        }
        n.setStatus(CriticalNotificationStatus.CLOSED);
        n.setClosedAt(Instant.now());
        notificationRepository.save(n);
        auditService.log(ACTION_CLOSED, ENTITY_TYPE, n.getResultId(), n.getPatientCode(),
                payload(n, "Escalation exhausted without acknowledgment"), null, n.getBranchCode());
        log.error("CRITICAL value callback CLOSED unacknowledged after {} escalations: patient={} {}={} — REQUIRES MANUAL FOLLOW-UP",
                maxEscalationLevels, n.getPatientCode(), n.getParameterName(), n.getResultValue());
    }

    // ---------------------------------------------------------------------
    // Acknowledgment (read-back)
    // ---------------------------------------------------------------------

    @Transactional
    public CriticalNotificationResponse acknowledge(UUID id, AcknowledgeCriticalRequest request) {
        CriticalValueNotification n = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Critical-value callback not found: " + id));
        if (!SecurityUtils.canAccessBranch(n.getBranchCode())) {
            throw new ResourceNotFoundException("Critical-value callback not found: " + id);
        }
        if (n.getStatus() == CriticalNotificationStatus.ACKNOWLEDGED) {
            return toResponse(n); // idempotent
        }
        if (n.getStatus() == CriticalNotificationStatus.CLOSED) {
            throw new BusinessRuleException("This critical-value callback is closed and cannot be acknowledged.");
        }
        if (request == null || request.getReadBackText() == null || request.getReadBackText().isBlank()) {
            throw new InvalidRequestException(
                    "A read-back (the value repeated back) is required to acknowledge a critical value.");
        }

        n.setStatus(CriticalNotificationStatus.ACKNOWLEDGED);
        n.setAcknowledgedBy(SecurityUtils.getCurrentDisplayName() != null
                ? SecurityUtils.getCurrentDisplayName() : SecurityUtils.getCurrentUsername());
        n.setAcknowledgedAt(Instant.now());
        n.setReadBackText(request.getReadBackText().trim());
        n.setCommunicatedTo(request.getCommunicatedTo());
        n.setReadBackVerified(request.getReadBackVerified());
        n.setNextEscalationDueAt(null);
        notificationRepository.save(n);

        auditService.log(ACTION_ACKNOWLEDGED, ENTITY_TYPE, n.getResultId(), n.getPatientCode(),
                payload(n, "Acknowledged with read-back"), null, n.getBranchCode());
        return toResponse(n);
    }

    // ---------------------------------------------------------------------
    // Queries (controller)
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<CriticalNotificationResponse> listOpen(int limit) {
        String branch = SecurityUtils.resolveBranchScope(); // null = super-admin (all branches)
        List<CriticalValueNotification> rows = branch == null
                ? notificationRepository.findByStatusInOrderByRaisedAtDesc(OPEN_STATUSES, PageRequest.of(0, limit))
                : notificationRepository.findByStatusInAndBranchCodeOrderByRaisedAtDesc(
                        OPEN_STATUSES, branch, PageRequest.of(0, limit));
        return rows.stream().map(this::toResponse).toList();
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private boolean sendCallout(CriticalValueNotification n, String contact, String channel) {
        if (contact == null || contact.isBlank()) {
            log.error("No contact resolved for critical callback {} — cannot deliver", n.getId());
            return false;
        }
        String subject = "CRITICAL LAB VALUE — patient " + n.getPatientCode();
        String body = String.format(
                "CRITICAL result requiring callback and read-back:%n"
                        + "Patient: %s%nTest: %s%nValue: %s (%s)%nPriority: %s%n"
                        + "Please acknowledge in the LIMS with a read-back of the value.",
                n.getPatientCode(), n.getParameterName(), n.getResultValue(), n.getFlag(), n.getPriority());
        try {
            if ("EMAIL".equals(channel)) {
                emailService.sendNotificationEmail(contact, subject, body.replace("\n", "<br>"));
            } else {
                smsService.sendSms(contact, subject + " — " + n.getParameterName() + " " + n.getResultValue());
            }
            return true;
        } catch (Exception e) {
            log.error("Failed to deliver critical callback {} via {} to {}", n.getId(), channel, contact, e);
            return false;
        }
    }

    private void recordAttempt(CriticalValueNotification n, int level, String contact, String channel, boolean sent) {
        CriticalValueEscalationAttempt attempt = new CriticalValueEscalationAttempt();
        attempt.setNotificationId(n.getId());
        attempt.setLevel(level);
        attempt.setChannel(channel);
        attempt.setRecipientContact(contact);
        attempt.setStatus(sent ? "SENT" : "FAILED");
        attempt.setSentAt(Instant.now());
        if (!sent) {
            attempt.setFailureReason("Delivery failed (provider unavailable)");
        }
        attemptRepository.save(attempt);
    }

    private Duration slaFor(Priority priority) {
        long minutes = priority == Priority.STAT ? statTimeoutMinutes : routineTimeoutMinutes;
        return Duration.ofMinutes(minutes);
    }

    private Priority parsePriority(String name) {
        if (name == null) {
            return Priority.NORMAL;
        }
        try {
            return Priority.valueOf(name);
        } catch (IllegalArgumentException e) {
            return Priority.NORMAL;
        }
    }

    private String payload(CriticalValueNotification n, String note) {
        Map<String, String> details = new HashMap<>();
        details.put("note", note);
        details.put("parameter", n.getParameterName());
        details.put("value", n.getResultValue());
        details.put("flag", n.getFlag());
        details.put("status", n.getStatus() == null ? null : n.getStatus().name());
        details.put("escalationLevel", String.valueOf(n.getEscalationLevel()));
        details.put("recipient", n.getRecipientName());
        try {
            return objectMapper.writeValueAsString(details);
        } catch (Exception e) {
            return "{\"note\":\"" + note + "\"}";
        }
    }

    private CriticalNotificationResponse toResponse(CriticalValueNotification n) {
        return CriticalNotificationResponse.builder()
                .id(n.getId() == null ? null : n.getId().toString())
                .resultId(n.getResultId() == null ? null : n.getResultId().toString())
                .patientCode(n.getPatientCode())
                .parameterName(n.getParameterName())
                .flag(n.getFlag())
                .resultValue(n.getResultValue())
                .priority(n.getPriority())
                .status(n.getStatus() == null ? null : n.getStatus().name())
                .escalationLevel(n.getEscalationLevel())
                .recipientName(n.getRecipientName())
                .recipientContact(n.getRecipientContact())
                .channel(n.getChannel())
                .raisedAt(n.getRaisedAt())
                .notifiedAt(n.getNotifiedAt())
                .nextEscalationDueAt(n.getNextEscalationDueAt())
                .acknowledgedBy(n.getAcknowledgedBy())
                .acknowledgedAt(n.getAcknowledgedAt())
                .readBackText(n.getReadBackText())
                .communicatedTo(n.getCommunicatedTo())
                .readBackVerified(n.getReadBackVerified())
                .build();
    }
}
