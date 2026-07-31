package com.uom.lims.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "test_parameters")
@Getter
@Setter
public class TestParameterEntity extends BaseEntity {

    @Column(name = "test_id", nullable = false)
    private UUID testId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "unit", length = 50)
    private String unit;

    /** LOINC code for this resultable parameter (interoperability: HL7/FHIR). */
    @Column(name = "loinc_code", length = 20)
    private String loincCode;

    /** UCUM-coded unit (machine-readable unit for conversion/exchange). */
    @Column(name = "ucum_unit", length = 32)
    private String ucumUnit;

    @Column(name = "ref_low", precision = 10, scale = 2)
    private BigDecimal refLow;

    @Column(name = "ref_high", precision = 10, scale = 2)
    private BigDecimal refHigh;

    /** Panic limits: a value at/below criticalLow or at/above criticalHigh is a
     * critical (panic) result. Analyte-specific — NOT derived from the reference
     * interval. Null means no defined critical limit for that direction. */
    @Column(name = "critical_low", precision = 10, scale = 2)
    private BigDecimal criticalLow;

    @Column(name = "critical_high", precision = 10, scale = 2)
    private BigDecimal criticalHigh;

    @Column(name = "display_order")
    private Integer displayOrder;
}