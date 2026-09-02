package com.uom.lims.repository;

import com.uom.lims.entity.OrderEntity;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@org.springframework.stereotype.Repository
public interface BranchReportRepository extends Repository<OrderEntity, UUID> {

    @Query("SELECT COUNT(DISTINCT o.patientId) FROM OrderEntity o WHERE (:branch = 'ALL' OR UPPER(o.branchCode) = UPPER(:branch)) AND o.createdAt BETWEEN :start AND :end AND o.deleted = false")
    long countDistinctPatients(@Param("branch") String branch, @Param("start") Instant start, @Param("end") Instant end);

    @Query("SELECT COUNT(o) FROM OrderEntity o WHERE (:branch = 'ALL' OR UPPER(o.branchCode) = UPPER(:branch)) AND o.createdAt BETWEEN :start AND :end AND o.deleted = false")
    long countOrders(@Param("branch") String branch, @Param("start") Instant start, @Param("end") Instant end);

    @Query("SELECT COUNT(o) FROM OrderEntity o WHERE (:branch = 'ALL' OR UPPER(o.branchCode) = UPPER(:branch)) AND o.createdAt BETWEEN :start AND :end AND o.deleted = false AND o.status IN ('PENDING', 'PARTIAL')")
    long countPendingOrders(@Param("branch") String branch, @Param("start") Instant start, @Param("end") Instant end);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM PaymentEntity p JOIN p.bill b JOIN b.order o WHERE (:branch = 'ALL' OR UPPER(o.branchCode) = UPPER(:branch)) AND p.createdAt BETWEEN :start AND :end AND o.deleted = false AND p.deleted = false AND b.deleted = false")
    BigDecimal sumRevenue(@Param("branch") String branch, @Param("start") Instant start, @Param("end") Instant end);

    interface RevenueTrendProjection {
        String getDateStr();
        BigDecimal getRevenue();
    }
    
    @Query(value = "SELECT TO_CHAR(p.created_at, 'DD MON') as dateStr, SUM(p.amount) as revenue " +
                   "FROM payments p " +
                   "JOIN bills b ON p.bill_id = b.id " +
                   "JOIN orders o ON b.order_id = o.id " +
                   "WHERE (:branch = 'ALL' OR UPPER(o.branch_code) = UPPER(:branch)) AND p.created_at BETWEEN :start AND :end " +
                   "AND o.is_deleted = false AND p.is_deleted = false " +
                   "GROUP BY TO_CHAR(p.created_at, 'DD MON'), DATE(p.created_at) " +
                   "ORDER BY DATE(p.created_at)", nativeQuery = true)
    List<RevenueTrendProjection> getRevenueTrend(@Param("branch") String branch, @Param("start") Instant start, @Param("end") Instant end);

    interface RevenueCategoryProjection {
        String getCategory();
        BigDecimal getRevenue();
    }

    @Query(value = "SELECT tc.category as category, SUM(oi.price) as revenue " +
                   "FROM order_items oi " +
                   "JOIN orders o ON oi.order_id = o.id " +
                   "JOIN test_catalog tc ON oi.test_id = tc.id " +
                   "WHERE (:branch = 'ALL' OR UPPER(o.branch_code) = UPPER(:branch)) AND o.created_at BETWEEN :start AND :end " +
                   "AND o.is_deleted = false AND oi.is_deleted = false " +
                   "GROUP BY tc.category", nativeQuery = true)
    List<RevenueCategoryProjection> getRevenueByCategory(@Param("branch") String branch, @Param("start") Instant start, @Param("end") Instant end);

    interface TestPerformanceProjection {
        String getTestName();
        Long getOrderCount();
        BigDecimal getRevenue();
    }

    @Query(value = "SELECT tc.test_name as testName, COUNT(oi.id) as orderCount, SUM(oi.price) as revenue " +
                   "FROM order_items oi " +
                   "JOIN orders o ON oi.order_id = o.id " +
                   "JOIN test_catalog tc ON oi.test_id = tc.id " +
                   "WHERE (:branch = 'ALL' OR UPPER(o.branch_code) = UPPER(:branch)) AND o.created_at BETWEEN :start AND :end " +
                   "AND o.is_deleted = false AND oi.is_deleted = false " +
                   "GROUP BY tc.test_name " +
                   "ORDER BY orderCount DESC", nativeQuery = true)
    List<TestPerformanceProjection> getTestPerformance(@Param("branch") String branch, @Param("start") Instant start, @Param("end") Instant end);
}
