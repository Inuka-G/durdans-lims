package com.uom.lims.refrange;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/** A sex/age-banded reference interval (with critical limits) for a parameter. */
@Entity
@Table(name = "reference_range")
@Getter
@Setter
public class ReferenceRangeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "parameter_id", nullable = false)
    private UUID parameterId;

    /** M | F | ANY */
    @Column(name = "sex", nullable = false, length = 8)
    private String sex = "ANY";

    /** Inclusive lower age bound in years; null = from birth. */
    @Column(name = "age_low_years")
    private Integer ageLowYears;

    /** Exclusive upper age bound in years; null = no upper bound. */
    @Column(name = "age_high_years")
    private Integer ageHighYears;

    @Column(name = "ref_low", precision = 10, scale = 2)
    private BigDecimal refLow;

    @Column(name = "ref_high", precision = 10, scale = 2)
    private BigDecimal refHigh;

    @Column(name = "critical_low", precision = 10, scale = 2)
    private BigDecimal criticalLow;

    @Column(name = "critical_high", precision = 10, scale = 2)
    private BigDecimal criticalHigh;
}
