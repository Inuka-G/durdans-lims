package com.uom.lims.qc;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QcResultRepository extends JpaRepository<QcResultEntity, UUID> {

    /** Most-recent-first series for one control (instrument + analyte + level). */
    List<QcResultEntity> findByInstrumentAndAnalyteAndControlLevelOrderByPerformedAtDesc(
            String instrument, String analyte, String controlLevel, Pageable pageable);

    /** Most recent runs across all controls (for the QC dashboard). */
    List<QcResultEntity> findByOrderByPerformedAtDesc(Pageable pageable);

    /**
     * Candidate controls governing a measurement on {@code instrument} for
     * {@code loinc} at time {@code at} — every control run at or before that
     * moment, newest first within each level.
     *
     * <p>The caller reduces this to the newest row per control level, because a
     * run is only in control if EVERY level was in control. Ordering by level
     * then time makes that reduction a single pass.
     */
    @org.springframework.data.jpa.repository.Query(
            "select q from QcResultEntity q "
                    + "where q.instrument = :instrument and q.loincCode = :loinc "
                    + "and q.performedAt <= :at "
                    + "order by q.controlLevel asc, q.performedAt desc")
    List<QcResultEntity> findGoverningCandidates(
            @org.springframework.data.repository.query.Param("instrument") String instrument,
            @org.springframework.data.repository.query.Param("loinc") String loinc,
            @org.springframework.data.repository.query.Param("at") java.time.Instant at,
            Pageable pageable);

    @org.springframework.data.jpa.repository.Query("select max(q.performedAt) from QcResultEntity q where q.instrument = :instrument")
    java.time.Instant findLatestQcActivity(@org.springframework.data.repository.query.Param("instrument") String instrument);
}
