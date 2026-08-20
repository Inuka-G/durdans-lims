package com.uom.lims.entity;

import com.uom.lims.api.enums.TubeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * WHY: Maps test definitions from the catalog providing centralized pricing and metadata lookup during order creation.
 */
@Entity
@Table(name = "test_catalog")
@Getter
@Setter
public class TestCatalogEntity extends BaseEntity {

    @Column(name = "test_code", unique = true, nullable = false)
    private String testCode;

    /** LOINC code for the orderable test/panel (interoperability: HL7/FHIR, external reporting). */
    @Column(name = "loinc_code", length = 20)
    private String loincCode;

    @Column(name = "test_name", nullable = false)
    private String testName;

    @Column(name = "category", nullable = false)
    private String category;

    @Column(name = "price", nullable = false)
    private BigDecimal price;

    @Column(name = "sample_type", nullable = false)
    private String sampleType;

    @Enumerated(EnumType.STRING)
    @Column(name = "tube_type", nullable = false)
    private TubeType tubeType;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "turn_around_time_hours")
    private Integer turnAroundTimeHours;

    /**
     * Patient preparation. Structured rather than prose-only because two things need to
     * read it as data: the agent, which must answer "do I have to fast?" identically in
     * three languages, and the slot picker, which must keep a fasting test out of an
     * afternoon appointment. The human-readable wording lives in
     * {@link TestCatalogI18nEntity#getPrepInstruction()}.
     *
     * <p>The default is deliberately "no fasting" only because most tests need none —
     * every test that does need it is set explicitly, since the failure mode of getting
     * this wrong is a rejected sample and a wasted patient visit.
     */
    @Column(name = "fasting_required", nullable = false)
    private boolean fastingRequired = false;

    /** Hours of fasting required. Null when {@link #fastingRequired} is false. */
    @Column(name = "fasting_hours")
    private Integer fastingHours;

    @Column(name = "water_allowed", nullable = false)
    private boolean waterAllowed = true;

    /** Preparation beyond fasting: a 24-hour collection, a medication hold, a container issued in advance. */
    @Column(name = "special_prep_required", nullable = false)
    private boolean specialPrepRequired = false;

}
