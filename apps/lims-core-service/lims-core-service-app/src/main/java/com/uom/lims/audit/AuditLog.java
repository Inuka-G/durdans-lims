package com.uom.lims.audit;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "audit_log")
@Getter
@Setter
@Immutable
public class AuditLog {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String action;

    @Column(name = "entity_type", nullable = false)
    private String entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(name = "patient_code")
    private String patientCode;

    @Column(name = "performed_by", nullable = false)
    private String performedBy;

    @Column(name = "branch_code", nullable = false)
    private String branchCode;

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(columnDefinition = "jsonb")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private String details;

    // ---- H3: tamper-evident hash chain. All three are populated by the
    // `trg_audit_log_seal` BEFORE-INSERT DB trigger, never by the application, so
    // they are mapped read-only (insertable/updatable=false). See changelog
    // 20260619120000_tamper_evident_audit_log.xml and AuditChainVerifier. ----

    /** Monotonic chain ordinal (DB sequence), assigned by the seal trigger. */
    @Column(name = "seq", insertable = false, updatable = false)
    private Long seq;

    /** SHA-256 of the immediately-prior sealed row (64 hex chars; genesis = 64 zeros). */
    @Column(name = "prev_hash", length = 64, insertable = false, updatable = false)
    private String prevHash;

    /** SHA-256 sealing this row's content + prev_hash (64 hex chars). */
    @Column(name = "row_hash", length = 64, insertable = false, updatable = false)
    private String rowHash;
}
