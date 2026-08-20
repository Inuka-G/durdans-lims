package com.uom.lims.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * One test inside a package. A test may belong to many packages; the unique constraint
 * on (package, test) stops it appearing twice inside the same one, which would both
 * double-bill the itemised view and inflate the advertised saving.
 */
@Entity
@Table(name = "test_package_item")
@Getter
@Setter
public class TestPackageItemEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "package_id", nullable = false)
    private TestPackageEntity testPackage;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "test_id", nullable = false)
    private TestCatalogEntity test;

    @Column(name = "display_order", nullable = false)
    private int displayOrder = 0;
}
