package com.uom.lims.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * WHY: a bundle of tests sold at a single price. The catalogue could already price one
 * test; "what does the diabetic package cost" was unanswerable, and it is the question
 * patients ask most.
 *
 * <p>The price is set by the business and stored, not derived from the sum of the items.
 * A package exists precisely because it costs less than its parts, so deriving it would
 * defeat the point — and a package whose price silently moved when someone repriced one
 * component would be quoted wrong.
 */
@Entity
@Table(name = "test_package")
@Getter
@Setter
public class TestPackageEntity extends BaseEntity {

    @Column(name = "package_code", unique = true, nullable = false, length = 64)
    private String packageCode;

    @Column(name = "package_name", nullable = false)
    private String packageName;

    @Column(name = "category", length = 128)
    private String category;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "price", nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @OneToMany(mappedBy = "testPackage", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("displayOrder ASC")
    private List<TestPackageItemEntity> items = new ArrayList<>();

    /**
     * What the same tests would cost bought individually. Computed for display so a
     * patient can see the saving; never persisted, because it changes whenever any
     * component is repriced.
     */
    public BigDecimal individualTotal() {
        return items.stream()
                .map(TestPackageItemEntity::getTest)
                .filter(java.util.Objects::nonNull)
                .map(TestCatalogEntity::getPrice)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Never negative: a package priced above its parts shows no saving, not a loss. */
    public BigDecimal saving() {
        BigDecimal saving = individualTotal().subtract(price == null ? BigDecimal.ZERO : price);
        return saving.signum() < 0 ? BigDecimal.ZERO : saving;
    }

    /**
     * True when any component test needs fasting. The strictest requirement wins, which
     * is why this is derived rather than a column someone has to remember to update when
     * a test is added to the bundle.
     */
    public boolean fastingRequired() {
        return items.stream()
                .map(TestPackageItemEntity::getTest)
                .filter(java.util.Objects::nonNull)
                .anyMatch(TestCatalogEntity::isFastingRequired);
    }

    /** The longest fasting period any component demands, or null if none do. */
    public Integer fastingHours() {
        return items.stream()
                .map(TestPackageItemEntity::getTest)
                .filter(java.util.Objects::nonNull)
                .filter(TestCatalogEntity::isFastingRequired)
                .map(TestCatalogEntity::getFastingHours)
                .filter(java.util.Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(null);
    }

    /**
     * The slowest component decides when the whole package is ready. Quoting anything
     * shorter is how a lab acquires a reputation for being late.
     */
    public Integer turnAroundTimeHours() {
        return items.stream()
                .map(TestPackageItemEntity::getTest)
                .filter(java.util.Objects::nonNull)
                .map(TestCatalogEntity::getTurnAroundTimeHours)
                .filter(java.util.Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(null);
    }
}
