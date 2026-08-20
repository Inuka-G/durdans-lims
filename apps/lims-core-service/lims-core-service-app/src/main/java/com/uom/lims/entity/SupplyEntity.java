package com.uom.lims.entity;

import com.uom.lims.api.enums.TubeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "supplies")
@Getter
@Setter
public class SupplyEntity extends BaseEntity {

    // Uniqueness is scoped to live rows by uq_supplies_item_no_live, so it is deliberately
    // not declared here: a plain unique = true would describe a table-wide constraint the
    // database no longer has, and would recreate one under a generating ddl-auto.
    @Column(name = "item_no", nullable = false, length = 50)
    private String itemNo;

    @Column(nullable = false)
    private String name;

    @Column
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(name = "tube_type")
    private TubeType tubeType;

    @Column(name = "tube_color")
    private String tubeColor;

    @Column(name = "current_stock", nullable = false)
    private Integer currentStock;

    @Column(name = "min_stock", nullable = false)
    private Integer minStock;

    @Column(name = "max_stock", nullable = false)
    private Integer maxStock;

    @Column
    private String unit;

    @Column(name = "last_restocked")
    private LocalDate lastRestocked;
}
