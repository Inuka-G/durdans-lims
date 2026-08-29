package com.uom.lims.service;

import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.audit.AuditLog;
import com.uom.lims.audit.AuditLogRepository;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.repository.TestResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Context that both the supervisor review and the pathologist review need for
 * one case: the patient's earlier results for the same test (previous visits and
 * the per-parameter value a delta check compares against) and when accessioning
 * received the specimen. Shared so the two review screens can never disagree
 * about what "previous" means.
 */
@Component
@RequiredArgsConstructor
public class CaseContextResolver {

    private static final String ACCESSIONING_ENTITY_TYPE = "SAMPLE_ACCESSIONING";
    private static final String ACCESSIONING_ACCEPTED = "ACCEPTED";

    /**
     * Only values that left the lab count as a prior for a delta check. A value
     * still sitting at ENTERED may itself be wrong — comparing against it would
     * turn one entry error into two held results.
     */
    private static final EnumSet<ResultStatus> RELEASED_STATUSES = EnumSet.of(
            ResultStatus.TECHNICALLY_VERIFIED,
            ResultStatus.CLINICALLY_AUTHORIZED,
            ResultStatus.DISPATCHED);

    private final TestResultRepository testResultRepository;
    private final AuditLogRepository auditLogRepository;

    /**
     * Every result of this patient for this test from specimens collected before
     * the current one, most recent visit first. Empty when any key is missing.
     */
    public List<TestResultEntity> priorResults(String patientId, UUID testId, SampleEntity currentSample) {
        if (patientId == null || patientId.isBlank() || testId == null || currentSample == null) {
            return List.of();
        }
        Instant currentVisitAt = visitedAt(currentSample);
        if (currentVisitAt == null) {
            return List.of();
        }
        return testResultRepository.findPreviousResultsForPatientAndTest(
                patientId.trim(), testId, currentSample.getId(), currentVisitAt);
    }

    /**
     * The most recent released prior value per parameter. Rows arrive newest visit
     * first, so the first released row seen for a parameter is the one to keep.
     */
    public Map<UUID, TestResultEntity> latestReleasedByParameter(List<TestResultEntity> priorResults) {
        Map<UUID, TestResultEntity> latest = new LinkedHashMap<>();
        for (TestResultEntity row : priorResults) {
            if (row.getParameter() == null || row.getStatus() == null
                    || !RELEASED_STATUSES.contains(row.getStatus())) {
                continue;
            }
            latest.putIfAbsent(row.getParameter().getId(), row);
        }
        return latest;
    }

    /**
     * When accessioning accepted the specimen into the lab. The sample row does
     * not carry this timestamp, but the accessioning audit row does — and that
     * row is tamper-evident, which is exactly what a received-at time should be.
     */
    public Instant receivedAt(UUID sampleId) {
        if (sampleId == null) {
            return null;
        }
        return auditLogRepository
                .findByEntityTypeAndEntityIdOrderByTimestampDesc(ACCESSIONING_ENTITY_TYPE, sampleId)
                .stream()
                .filter(row -> ACCESSIONING_ACCEPTED.equals(row.getAction()))
                .map(AuditLog::getTimestamp)
                .filter(java.util.Objects::nonNull)
                .findFirst()
                // AuditService writes LocalDateTime.now(UTC); read it back the same way.
                .map(timestamp -> timestamp.atOffset(ZoneOffset.UTC).toInstant())
                .orElse(null);
    }

    /** Collection time, falling back to creation time for specimens never stamped. */
    public static Instant visitedAt(SampleEntity sample) {
        if (sample == null) {
            return null;
        }
        return sample.getCollectedAt() != null ? sample.getCollectedAt() : sample.getCreatedAt();
    }

    /** What the screens showed before case numbers existed: the last eight hex digits of the UUID. */
    private static final Pattern LEGACY_DISPLAY_ID = Pattern.compile("^(?:RES|REP)-([0-9a-fA-F]{8})$");

    /**
     * Trims the history search term; a legacy {@code RES-1A2B3C4D} display id is
     * reduced to its hex tail so it still matches the result id it was cut from.
     * Returns null for an empty term so the query skips the search clause.
     */
    public static String normalizeHistorySearch(String search) {
        if (search == null) {
            return null;
        }
        String trimmed = search.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        Matcher legacy = LEGACY_DISPLAY_ID.matcher(trimmed);
        return legacy.matches() ? legacy.group(1) : trimmed;
    }
}
