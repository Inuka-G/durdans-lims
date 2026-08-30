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
 * A test's name and preparation text in one language.
 *
 * <p>{@link #reviewedAt} is the gate, and it is the reason this table exists rather than
 * a translation call at request time. A medical term translated by a machine and quoted
 * to a patient is a clinical risk, not a cosmetic one — so an unreviewed row is invisible
 * to callers and the English name is used instead. Falling back is always safe; guessing
 * is not.
 */
@Entity
@Table(name = "test_catalog_i18n")
@Getter
@Setter
public class TestCatalogI18nEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "test_id", nullable = false)
    private TestCatalogEntity test;

    /** BCP-47 primary subtag: si | ta | en. */
    @Column(name = "locale", nullable = false, length = 8)
    private String locale;

    @Column(name = "test_name", nullable = false)
    private String testName;

    /**
     * What patients call it, which is rarely the formal translation — and is what the
     * voice model needs in order to match a half-heard test name to the catalogue.
     */
    @Column(name = "colloquial_name")
    private String colloquialName;

    @Column(name = "prep_instruction", columnDefinition = "text")
    private String prepInstruction;

    /**
     * Keycloak subject of whoever last saved this draft — compared against the
     * reviewer's own subject so the person who wrote the translation can't also
     * be the one who approves it. Subject, not display name: the two clinical
     * roles that can review (LAB_SUPERVISOR, PATHOLOGIST) also both appear in
     * the roles that can save a draft, so this is the actual enforcement point.
     */
    @Column(name = "drafted_by")
    private String draftedBy;

    @Column(name = "reviewed_by")
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    public boolean isReviewed() {
        return reviewedAt != null;
    }
}
