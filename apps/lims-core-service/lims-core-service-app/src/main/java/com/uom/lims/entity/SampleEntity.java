package com.uom.lims.entity;

import com.uom.lims.api.enums.Priority;
import com.uom.lims.api.enums.RejectionReason;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.enums.TubeType;
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

/**
 * WHY: Maps physical custody and handling properties for a clinical specimen
 * tracking the medicolegal chain of custody.
 */
@Entity
@Table(name = "samples")
@Getter
@Setter
public class SampleEntity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id", nullable = false)
    private OrderItemEntity orderItem;

    @Column(name = "barcode", unique = true, nullable = false)
    private String barcode;

    @Enumerated(EnumType.STRING)
    @Column(name = "tube_type", nullable = false)
    private TubeType tubeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private SampleStatus status = SampleStatus.PENDING_COLLECTION;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false)
    private Priority priority;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_sample_id")
    private SampleEntity parentSample;

    @Column(name = "recollection_count", nullable = false)
    private Integer recollectionCount = 0;

    @Column(name = "collected_at")
    private Instant collectedAt;

    @Column(name = "collected_by")
    private String collectedBy;

    @Column(name = "rejected_at")
    private Instant rejectedAt;

    @Column(name = "rejected_by")
    private String rejectedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "rejection_reason")
    private RejectionReason rejectionReason;

    @Column(name = "rejection_notes", length = 500)
    private String rejectionNotes;

    /** Incremented when users confirm specimen barcode label print/reprint (audit trail). */
    @Column(name = "label_print_count", nullable = false)
    private int labelPrintCount = 0;
}
