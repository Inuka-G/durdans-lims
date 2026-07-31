package com.uom.lims.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;
import java.util.Collection;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

        List<AuditLog> findByEntityTypeAndEntityIdOrderByTimestampDesc(String entityType, UUID entityId);

        /** Sealed rows (row_hash populated by the seal trigger) in chain order — for H3 verification. */
        List<AuditLog> findByRowHashIsNotNullOrderBySeqAsc();

        List<AuditLog> findByEntityTypeAndEntityIdInAndActionInOrderByTimestampAsc(
                        String entityType,
                        Collection<UUID> entityIds,
                        Collection<String> actions);

        @Query(value = """
                        SELECT *
                        FROM audit_log a
                        WHERE a.entity_type = :entityType
                          AND a.action IN (:actions)
                          AND (
                                :search IS NULL
                                OR LOWER(COALESCE(CAST(a.entity_id AS TEXT), '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                OR LOWER(COALESCE(a.performed_by, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                OR LOWER(COALESCE(CAST(a.details AS TEXT), '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                              )
                        ORDER BY a.timestamp DESC
                        """, countQuery = """
                        SELECT COUNT(*)
                        FROM audit_log a
                        WHERE a.entity_type = :entityType
                          AND a.action IN (:actions)
                          AND (
                                :search IS NULL
                                OR LOWER(COALESCE(CAST(a.entity_id AS TEXT), '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                OR LOWER(COALESCE(a.performed_by, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                OR LOWER(COALESCE(CAST(a.details AS TEXT), '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                              )
                        """, nativeQuery = true)
        Page<AuditLog> findHistoryByEntityTypeAndActions(
                        @Param("entityType") String entityType,
                        @Param("actions") java.util.List<String> actions,
                        @Param("search") String search,
                        Pageable pageable);

        Page<AuditLog> findByEntityTypeAndActionInOrderByTimestampDesc(
                        String entityType,
                        java.util.List<String> actions,
                        Pageable pageable);

        Page<AuditLog> findByBranchCode(String branchCode, Pageable pageable);

        @Query(value = "SELECT * FROM audit_log a WHERE a.branch_code = :branchCode " +
                        "AND (:action IS NULL OR a.action = CAST(:action AS VARCHAR)) " +
                        "AND (:entityType IS NULL OR a.entity_type = CAST(:entityType AS VARCHAR)) " +
                        "AND (:performedBy IS NULL OR a.performed_by = CAST(:performedBy AS VARCHAR)) " +
                        "AND (:search IS NULL OR (" +
                        "    LOWER(CAST(COALESCE(a.patient_code, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%') OR "
                        +
                        "    LOWER(CAST(COALESCE(a.performed_by, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%') OR "
                        +
                        "    LOWER(CAST(COALESCE(a.action, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%') OR "
                        +
                        "    LOWER(CAST(COALESCE(a.entity_type, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%')"
                        +
                        "))", countQuery = "SELECT COUNT(*) FROM audit_log a WHERE a.branch_code = :branchCode " +
                                        "AND (:action IS NULL OR a.action = CAST(:action AS VARCHAR)) " +
                                        "AND (:entityType IS NULL OR a.entity_type = CAST(:entityType AS VARCHAR)) " +
                                        "AND (:performedBy IS NULL OR a.performed_by = CAST(:performedBy AS VARCHAR)) "
                                        +
                                        "AND (:search IS NULL OR (" +
                                        "    LOWER(CAST(COALESCE(a.patient_code, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%') OR "
                                        +
                                        "    LOWER(CAST(COALESCE(a.performed_by, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%') OR "
                                        +
                                        "    LOWER(CAST(COALESCE(a.action, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%') OR "
                                        +
                                        "    LOWER(CAST(COALESCE(a.entity_type, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%')"
                                        +
                                        "))", nativeQuery = true)
        Page<AuditLog> findByBranchCodeFiltered(
                        @Param("branchCode") String branchCode,
                        @Param("action") String action,
                        @Param("entityType") String entityType,
                        @Param("performedBy") String performedBy,
                        @Param("search") String search,
                        Pageable pageable);

        @Query(value = "SELECT * FROM audit_log a WHERE " +
                        "(:action IS NULL OR a.action = CAST(:action AS VARCHAR)) " +
                        "AND (:entityType IS NULL OR a.entity_type = CAST(:entityType AS VARCHAR)) " +
                        "AND (:performedBy IS NULL OR a.performed_by = CAST(:performedBy AS VARCHAR)) " +
                        "AND (:search IS NULL OR (" +
                        "    LOWER(CAST(COALESCE(a.patient_code, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%') OR "
                        +
                        "    LOWER(CAST(COALESCE(a.performed_by, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%') OR "
                        +
                        "    LOWER(CAST(COALESCE(a.action, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%') OR "
                        +
                        "    LOWER(CAST(COALESCE(a.entity_type, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%')"
                        +
                        "))", countQuery = "SELECT COUNT(*) FROM audit_log a WHERE " +
                                        "(:action IS NULL OR a.action = CAST(:action AS VARCHAR)) " +
                                        "AND (:entityType IS NULL OR a.entity_type = CAST(:entityType AS VARCHAR)) " +
                                        "AND (:performedBy IS NULL OR a.performed_by = CAST(:performedBy AS VARCHAR)) "
                                        +
                                        "AND (:search IS NULL OR (" +
                                        "    LOWER(CAST(COALESCE(a.patient_code, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%') OR "
                                        +
                                        "    LOWER(CAST(COALESCE(a.performed_by, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%') OR "
                                        +
                                        "    LOWER(CAST(COALESCE(a.action, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%') OR "
                                        +
                                        "    LOWER(CAST(COALESCE(a.entity_type, '') AS TEXT)) LIKE LOWER('%' || CAST(:search AS TEXT) || '%')"
                                        +
                                        "))", nativeQuery = true)
        Page<AuditLog> findAllFiltered(
                        @Param("action") String action,
                        @Param("entityType") String entityType,
                        @Param("performedBy") String performedBy,
                        @Param("search") String search,
                        Pageable pageable);
}
