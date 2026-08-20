package com.uom.lims.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * A package's name and description in one language. Same review gate as
 * {@link TestCatalogI18nEntity}: unreviewed rows are not served.
 */
@Entity
@Table(name = "test_package_i18n")
@Getter
@Setter
public class TestPackageI18nEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "package_id", nullable = false)
    private TestPackageEntity testPackage;

    @Column(name = "locale", nullable = false, length = 8)
    private String locale;

    @Column(name = "package_name", nullable = false)
    private String packageName;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "reviewed_by")
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    public boolean isReviewed() {
        return reviewedAt != null;
    }
}
