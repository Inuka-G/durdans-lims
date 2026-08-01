package com.uom.lims.instrument;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * The canonical instrument vocabulary.
 *
 * <p>"Instrument" previously existed in three unreconciled identifier spaces —
 * display names in {@code qc_result}, {@code inst-00N} in
 * {@code reference-data/instruments.json}, and the literal {@code ASTM-IN-01} in
 * the TCP listener's config. A QC gate keyed on any one of them would join zero
 * rows, which is the structural reason QC could not gate anything.
 *
 * <p>The primary key is the code itself rather than a surrogate UUID: it is the
 * value that travels on the wire from the analyser and appears on the QC form, so
 * a second identifier would only reintroduce the mismatch this table exists to
 * remove.
 */
@Entity
@Table(name = "instrument")
@Getter
@Setter
public class InstrumentEntity {

    @Id
    @Column(name = "code", length = 64, nullable = false)
    private String code;

    @Column(name = "name", length = 128, nullable = false)
    private String name;

    @Column(name = "instrument_type", length = 64)
    private String instrumentType;

    @Column(name = "branch_code", length = 50)
    private String branchCode;

    /**
     * False for genuine bench methods — microscopy, manual ESR — which have no
     * analyser and therefore cannot have analyser QC. Demanding QC of them would
     * block work that no control can ever clear.
     */
    @Column(name = "qc_required", nullable = false)
    private boolean qcRequired = true;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;
}
