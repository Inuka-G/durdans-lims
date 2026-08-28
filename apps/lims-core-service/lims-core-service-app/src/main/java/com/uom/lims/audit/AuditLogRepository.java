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
                          AND (CAST(:fromTimestamp AS TIMESTAMP) IS NULL
                                OR a.timestamp >= CAST(:fromTimestamp AS TIMESTAMP))
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
                          AND (CAST(:fromTimestamp AS TIMESTAMP) IS NULL
                                OR a.timestamp >= CAST(:fromTimestamp AS TIMESTAMP))
                          AND (
                                :search IS NULL
                                OR LOWER(COALESCE(CAST(a.entity_id AS TEXT), '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                OR LOWER(COALESCE(a.performed_by, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                OR LOWER(COALESCE(CAST(a.details AS TEXT), '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                              )
                        """, nativeQuery = true)
        /**
         * @param fromTimestamp inclusive lower bound for the audit timestamp, or
         *                      {@code null} for "all time". Lets the history screens
         *                      offer Today / Last 7 days / Last 30 days without
         *                      pulling the whole trail back and filtering in the UI.
         */
        Page<AuditLog> findHistoryByEntityTypeAndActions(
                        @Param("entityType") String entityType,
                        @Param("actions") java.util.List<String> actions,
                        @Param("search") String search,
                        @Param("fromTimestamp") java.time.LocalDateTime fromTimestamp,
                        Pageable pageable);

        Page<AuditLog> findByEntityTypeAndActionInOrderByTimestampDesc(
                        String entityType,
                        java.util.List<String> actions,
                        Pageable pageable);

        Page<AuditLog> findByBranchCode(String branchCode, Pageable pageable);

        @Query(value = "SELECT * FROM audit_log a WHERE LOWER(a.branch_code) = LOWER(CAST(:branchCode AS VARCHAR)) " +
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
                        ")) " +
                        "AND (CAST(:startDate AS TIMESTAMP) IS NULL OR a.timestamp >= CAST(:startDate AS TIMESTAMP)) " +
                        "AND (CAST(:endDate AS TIMESTAMP) IS NULL OR a.timestamp <= CAST(:endDate AS TIMESTAMP))", 
                        countQuery = "SELECT COUNT(*) FROM audit_log a WHERE LOWER(a.branch_code) = LOWER(CAST(:branchCode AS VARCHAR)) " +
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
                                        ")) " +
                                        "AND (CAST(:startDate AS TIMESTAMP) IS NULL OR a.timestamp >= CAST(:startDate AS TIMESTAMP)) " +
                                        "AND (CAST(:endDate AS TIMESTAMP) IS NULL OR a.timestamp <= CAST(:endDate AS TIMESTAMP))", nativeQuery = true)
        Page<AuditLog> findByBranchCodeFiltered(
                        @Param("branchCode") String branchCode,
                        @Param("action") String action,
                        @Param("entityType") String entityType,
                        @Param("performedBy") String performedBy,
                        @Param("search") String search,
                        @Param("startDate") java.time.LocalDateTime startDate,
                        @Param("endDate") java.time.LocalDateTime endDate,
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
                        ")) " +
                        "AND (CAST(:startDate AS TIMESTAMP) IS NULL OR a.timestamp >= CAST(:startDate AS TIMESTAMP)) " +
                        "AND (CAST(:endDate AS TIMESTAMP) IS NULL OR a.timestamp <= CAST(:endDate AS TIMESTAMP))", 
                        countQuery = "SELECT COUNT(*) FROM audit_log a WHERE " +
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
                                        ")) " +
                                        "AND (CAST(:startDate AS TIMESTAMP) IS NULL OR a.timestamp >= CAST(:startDate AS TIMESTAMP)) " +
                                        "AND (CAST(:endDate AS TIMESTAMP) IS NULL OR a.timestamp <= CAST(:endDate AS TIMESTAMP))", nativeQuery = true)
        Page<AuditLog> findAllFiltered(
                        @Param("action") String action,
                        @Param("entityType") String entityType,
                        @Param("performedBy") String performedBy,
                        @Param("search") String search,
                        @Param("startDate") java.time.LocalDateTime startDate,
                        @Param("endDate") java.time.LocalDateTime endDate,
                        Pageable pageable);
}
