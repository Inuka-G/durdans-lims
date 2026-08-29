package com.uom.lims.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * WHY: Represents a standalone lab test specific to a branch.
 */
@Entity
@Table(name = "branch_test")
@Getter
@Setter
public class BranchTestEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id", nullable = false)
    private BranchEntity branch;

    @Column(name = "test_name", nullable = false)
    private String testName;

    @Column(name = "test_code", nullable = false)
    private String testCode;

    @Column(name = "category", nullable = false)
    private String category;

    @Column(name = "price", nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "turnaround_time", nullable = false)
    private String turnaroundTime;

    @Column(name = "unit")
    private String unit;

    @Column(name = "reference_range")
    private String referenceRange;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

}
