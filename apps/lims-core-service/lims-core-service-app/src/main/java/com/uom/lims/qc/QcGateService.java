package com.uom.lims.qc;

import com.uom.lims.instrument.InstrumentEntity;
import com.uom.lims.instrument.InstrumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Decides whether the internal QC governing a measurement permits it to be
 * released.
 *
 * <p>This is the only place in the codebase that reasons about QC state. Westgard
 * evaluation already happened when the control was recorded ({@link QcService});
 * this answers the separate question the system never asked — <em>does that
 * verdict allow this patient result out?</em>
 *
 * <h2>What "the governing QC" means</h2>
 *
 * <p>For a measurement on instrument {@code I} of analyte {@code L} at time
 * {@code T}: take, for each control level, the most recent run at or before
 * {@code T}. The verdict is the worst of those. A run is in control only if every
 * level was in control, which is why this is a per-level reduction rather than a
 * single newest row.
 *
 * <p>{@code T} is the measurement time, never {@code now()} — a result sitting
 * three days in the verification queue must not go stale by ageing. Staleness is a
 * property of the analytical run, not of the paperwork.
 *
 * <p>Time-bracketing is an inference where an explicit run identifier would be a
 * record. There is no run id on the ASTM wire to key on, so this is the honest
 * approximation; see {@code docs/QC-RELEASE-GATE-DESIGN.md} for why, and what it
 * would take to do better.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QcGateService {

    /** Enough levels and history to find the newest run of each control level. */
    private static final int CANDIDATE_WINDOW = 20;

    private final QcResultRepository qcResultRepository;
    private final InstrumentRepository instrumentRepository;

    @Value("${app.qc.max-age-hours:24}")
    private long maxAgeHours;

    public enum QcState {
        /** Every governing control level passed. */
        PASS,
        /**
         * A 1-2s warning only. Westgard defines 1-2s as a warning rule, not a
         * rejection rule; holding on it produces constant false holds and the gate
         * gets switched off within a week. Advisory — shown, not enforced.
         */
        WARN,
        /** A rejection rule fired: 1-3s, 2-2s, R-4s, 4-1s or 10x. */
        FAIL,
        /** The newest governing control is older than the configured window. */
        STALE,
        /** No control has ever been recorded for this instrument and analyte. */
        NO_QC,
        /** A bench method with no analyser — analyser QC cannot exist for it. */
        NOT_REQUIRED,
        /** No instrument or no measurement time recorded — rows predating the gate. */
        NOT_EVALUATED;

        /**
         * Whether this state must stop a release.
         *
         * <p>Fail-safe: an unknown QC state holds. NOT_EVALUATED does not, because
         * it means "this row predates the gate", not "this run was uncontrolled" —
         * blocking the entire existing backlog would be a data-migration decision
         * disguised as a safety one.
         */
        public boolean holds() {
            return this == FAIL || this == STALE || this == NO_QC;
        }
    }

    /**
     * @param state         the verdict
     * @param governingQcId the control run that produced it, when there was one
     * @param detail        human-readable reason, safe to surface to a supervisor
     */
    public record QcVerdict(QcState state, UUID governingQcId, String detail) {

        public boolean holds() {
            return state.holds();
        }
    }

    @Transactional(readOnly = true)
    public QcVerdict evaluate(String instrumentCode, String loincCode, Instant measuredAt) {
        if (isBlank(instrumentCode) || isBlank(loincCode) || measuredAt == null) {
            return new QcVerdict(QcState.NOT_EVALUATED, null,
                    "No instrument or measurement time recorded for this result");
        }

        InstrumentEntity instrument = instrumentRepository.findByCodeAndActiveTrue(instrumentCode).orElse(null);
        if (instrument == null) {
            // An unknown code is a configuration error, not a passing control. Say so
            // loudly: silently treating it as NOT_REQUIRED would disable the gate for
            // every result from that analyser.
            log.warn("QC gate: unknown or inactive instrument code '{}' — treating as no QC", instrumentCode);
            return new QcVerdict(QcState.NO_QC, null,
                    "Instrument '" + instrumentCode + "' is not in the instrument registry");
        }
        if (!instrument.isQcRequired()) {
            return new QcVerdict(QcState.NOT_REQUIRED, null,
                    instrument.getName() + " is a manual method and has no analyser QC");
        }

        List<QcResultEntity> candidates = qcResultRepository.findGoverningCandidates(
                instrumentCode, loincCode, measuredAt, PageRequest.of(0, CANDIDATE_WINDOW));
        if (candidates.isEmpty()) {
            return new QcVerdict(QcState.NO_QC, null,
                    "No QC has been recorded for " + loincCode + " on " + instrument.getName());
        }

        // Newest run per control level. The query orders by level then time
        // descending, so the first row seen for a level is that level's newest.
        Map<String, QcResultEntity> newestPerLevel = new HashMap<>();
        for (QcResultEntity candidate : candidates) {
            newestPerLevel.putIfAbsent(String.valueOf(candidate.getControlLevel()), candidate);
        }

        QcResultEntity newest = newestPerLevel.values().stream()
                .max(java.util.Comparator.comparing(QcResultEntity::getPerformedAt))
                .orElseThrow();

        Instant staleBefore = measuredAt.minus(Duration.ofHours(maxAgeHours));
        if (newest.getPerformedAt().isBefore(staleBefore)) {
            return new QcVerdict(QcState.STALE, newest.getId(),
                    "The most recent QC for " + loincCode + " on " + instrument.getName()
                            + " predates this measurement by more than " + maxAgeHours + " hours");
        }

        QcResultEntity worst = null;
        QcState worstState = QcState.PASS;
        for (QcResultEntity levelRun : newestPerLevel.values()) {
            QcState state = mapStatus(levelRun.getStatus());
            if (severity(state) > severity(worstState)) {
                worstState = state;
                worst = levelRun;
            }
        }

        if (worstState == QcState.PASS) {
            return new QcVerdict(QcState.PASS, newest.getId(),
                    "QC in control across " + newestPerLevel.size() + " level(s)");
        }
        return new QcVerdict(worstState, worst == null ? newest.getId() : worst.getId(),
                "QC " + worstState + " for " + loincCode + " on " + instrument.getName()
                        + (worst != null && worst.getViolations() != null
                                ? " (" + worst.getViolations() + ", level " + worst.getControlLevel() + ")"
                                : ""));
    }

    private static QcState mapStatus(String status) {
        if (status == null) {
            return QcState.FAIL;
        }
        return switch (status.trim().toUpperCase()) {
            case "PASS" -> QcState.PASS;
            case "WARN" -> QcState.WARN;
            default -> QcState.FAIL;
        };
    }

    private static int severity(QcState state) {
        return switch (state) {
            case PASS -> 0;
            case WARN -> 1;
            default -> 2;
        };
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
