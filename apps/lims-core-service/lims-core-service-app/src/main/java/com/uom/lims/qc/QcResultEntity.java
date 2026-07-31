package com.uom.lims.qc;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** One recorded internal-QC measurement, with its Westgard evaluation. */
@Entity
@Table(name = "qc_result")
@Getter
@Setter
public class QcResultEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "instrument", nullable = false, length = 64)
    private String instrument;

    @Column(name = "analyte", nullable = false, length = 64)
    private String analyte;

    @Column(name = "control_level", nullable = false, length = 16)
    private String controlLevel;

    @Column(name = "control_lot", length = 64)
    private String controlLot;

    @Column(name = "measured_value", nullable = false, precision = 14, scale = 4)
    private BigDecimal measuredValue;

    @Column(name = "mean", nullable = false, precision = 14, scale = 4)
    private BigDecimal mean;

    @Column(name = "sd", nullable = false, precision = 14, scale = 4)
    private BigDecimal sd;

    @Column(name = "z_score", precision = 8, scale = 3)
    private BigDecimal zScore;

    /** PASS | WARN | FAIL */
    @Column(name = "status", nullable = false, length = 8)
    private String status;

    @Column(name = "violations", length = 128)
    private String violations;

    @Column(name = "performed_by", length = 255)
    private String performedBy;

    @Column(name = "performed_at", nullable = false)
    private Instant performedAt = Instant.now();

    @Column(name = "branch_code", length = 50)
    private String branchCode;
}
