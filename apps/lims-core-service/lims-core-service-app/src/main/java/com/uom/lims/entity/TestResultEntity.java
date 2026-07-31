package com.uom.lims.entity;

import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.verification.enums.ResultStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "test_results")
@Getter
@Setter
public class TestResultEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sample_id", nullable = false)
    private SampleEntity sample;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parameter_id", nullable = false)
    private TestParameterEntity parameter;

    @Column(name = "result_value", nullable = false, length = 100)
    private String resultValue;

    /** Parsed numeric value (when the result is numeric) so results can be
     * indexed, range-queried, trended and delta-checked without string parsing.
     * Null for qualitative/text results. */
    @Column(name = "result_numeric", precision = 14, scale = 4)
    private java.math.BigDecimal resultNumeric;

    /** NUMERIC | QUALITATIVE | TEXT — discriminates the result value type. */
    @Column(name = "result_data_type", length = 16)
    private String resultDataType;

    @Enumerated(EnumType.STRING)
    @Column(name = "flag", length = 30)
    private ResultFlag flag;

    @Column(name = "mlt_notes", length = 500)
    private String mltNotes;

    @Column(name = "is_draft", nullable = false)
    private Boolean draft = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 50)
    private ResultStatus status;

    @Column(name = "return_reason", columnDefinition = "TEXT")
    private String returnReason;

    @Column(name = "clinical_note", columnDefinition = "TEXT")
    private String clinicalNote;

    @Column(name = "technically_verified_by", length = 255)
    private String technicallyVerifiedBy;

    @Column(name = "technically_verified_at")
    private Instant technicallyVerifiedAt;

    @Column(name = "clinically_authorized_by", length = 255)
    private String clinicallyAuthorizedBy;

    @Column(name = "clinically_authorized_at")
    private Instant clinicallyAuthorizedAt;

    /** Electronic-signature manifestation captured at authorization (who/when/meaning). */
    @Column(name = "clinical_signature", length = 255)
    private String clinicalSignature;

    @Column(name = "returned_by", length = 255)
    private String returnedBy;

    @Column(name = "returned_at")
    private Instant returnedAt;

    /** Current version of this result; 1 = original, incremented by each amendment (H2). */
    @Column(name = "version_no", nullable = false)
    private Integer versionNo = 1;

    /** True once a released value has been corrected via the amendment workflow (H2). */
    @Column(name = "is_amended", nullable = false)
    private Boolean amended = false;
}
