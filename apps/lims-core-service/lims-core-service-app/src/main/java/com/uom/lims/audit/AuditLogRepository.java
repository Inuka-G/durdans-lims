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

        /*
         * The history screens promise an all-fields search: patient name and code,
         * case number, result id, test, performer, notes and the action itself. The
         * audit row alone cannot honour that — its patient_code column carries the
         * specimen barcode on these writes and the patient's name is not stored at
         * all — so the patient and case number are reached through the result the
         * row points at (result -> sample -> order item -> order -> patient). The
         * EXISTS keeps one row per audit event however many joins match.
         */
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
                                OR LOWER(COALESCE(a.action, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                OR LOWER(COALESCE(CAST(a.details AS TEXT), '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                OR EXISTS (
                                        SELECT 1
                                        FROM test_results tr
                                        JOIN samples s ON s.id = tr.sample_id
                                        JOIN order_items oi ON oi.id = s.order_item_id
                                        JOIN orders o ON o.id = oi.order_id
                                        LEFT JOIN patient p ON p.patient_code = o.patient_id
                                        WHERE tr.id = a.entity_id
                                          AND (
                                                LOWER(COALESCE(s.result_no, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                                OR LOWER(COALESCE(s.barcode, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                                OR LOWER(COALESCE(o.patient_id, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                                OR LOWER(COALESCE(p.full_name, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                          )
                                )
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
                                OR LOWER(COALESCE(a.action, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                OR LOWER(COALESCE(CAST(a.details AS TEXT), '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                OR EXISTS (
                                        SELECT 1
                                        FROM test_results tr
                                        JOIN samples s ON s.id = tr.sample_id
                                        JOIN order_items oi ON oi.id = s.order_item_id
                                        JOIN orders o ON o.id = oi.order_id
                                        LEFT JOIN patient p ON p.patient_code = o.patient_id
                                        WHERE tr.id = a.entity_id
                                          AND (
                                                LOWER(COALESCE(s.result_no, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                                OR LOWER(COALESCE(s.barcode, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                                OR LOWER(COALESCE(o.patient_id, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                                OR LOWER(COALESCE(p.full_name, '')) LIKE LOWER(CONCAT('%%', CAST(:search AS TEXT), '%%'))
                                          )
                                )
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
