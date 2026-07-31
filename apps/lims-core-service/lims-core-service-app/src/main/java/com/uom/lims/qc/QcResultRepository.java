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
}
