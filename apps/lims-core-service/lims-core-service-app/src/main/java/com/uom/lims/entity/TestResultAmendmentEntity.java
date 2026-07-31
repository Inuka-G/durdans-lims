package com.uom.lims.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Immutable history of a correction to a released {@link TestResultEntity} (H2).
 *
 * <p>One row is written per amendment, snapshotting the value/numeric/flag/status as
 * they were BEFORE the correction, alongside the new value and the mandatory reason +
 * e-signature. The live test_results row is updated in place (so existing queries and
 * the unique (sample,parameter) key are unaffected); the full lineage lives here.
 */
@Entity
@Table(name = "test_result_amendment")
@Getter
@Setter
public class TestResultAmendmentEntity extends BaseEntity {

    @Column(name = "test_result_id", nullable = false)
    private UUID testResultId;

    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @Column(name = "previous_value", length = 100)
    private String previousValue;

    @Column(name = "previous_numeric", precision = 14, scale = 4)
    private BigDecimal previousNumeric;

    @Column(name = "previous_flag", length = 30)
    private String previousFlag;

    @Column(name = "previous_status", length = 50)
    private String previousStatus;

    @Column(name = "new_value", length = 100)
    private String newValue;

    @Column(name = "new_numeric", precision = 14, scale = 4)
    private BigDecimal newNumeric;

    @Column(name = "new_flag", length = 30)
    private String newFlag;

    @Column(name = "amendment_reason", columnDefinition = "TEXT", nullable = false)
    private String amendmentReason;

    @Column(name = "amended_by", length = 255, nullable = false)
    private String amendedBy;

    @Column(name = "amended_at", nullable = false)
    private Instant amendedAt;

    @Column(name = "signature", length = 255)
    private String signature;
}
