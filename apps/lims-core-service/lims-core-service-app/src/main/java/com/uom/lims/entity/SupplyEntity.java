package com.uom.lims.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "supplies")
@Getter
@Setter
public class SupplyEntity extends BaseEntity {

    @Column(name = "item_no", nullable = false, unique = true)
    private String itemNo;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    @Column(name = "tube_color")
    private String tubeColor;

    @Column(name = "current_stock", nullable = false)
    private Integer currentStock;

    @Column(name = "min_stock", nullable = false)
    private Integer minStock;

    @Column(name = "max_stock", nullable = false)
    private Integer maxStock;

    @Column(nullable = false)
    private String unit;

    @Column(name = "last_restocked")
    private LocalDate lastRestocked;
}
