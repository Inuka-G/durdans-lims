package com.uom.lims.api.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class BranchReportResponse {
    private Kpi kpis;
    private List<RevenueTrend> revenueTrend;
    private List<RevenueCategory> revenueByCategory;
    private List<TestPerformance> topPerformingTests;
    private List<TestPerformance> leastPerformingTests;

    @Data
    @Builder
    public static class Kpi {
        private String totalPatients;
        private Double patientsChange;
        
        private String totalOrders;
        private Double ordersChange;
        
        private String totalRevenue;
        private Double revenueChange;
        
        private String pendingReports;
        private Double pendingReportsChange;
    }

    @Data
    @Builder
    public static class RevenueTrend {
        private String date;
        private BigDecimal revenue;
    }

    @Data
    @Builder
    public static class RevenueCategory {
        private String name;
        private Double value;
        private String color;
    }

    @Data
    @Builder
    public static class TestPerformance {
        private String testName;
        private Long orderCount;
        private BigDecimal revenue;
    }
}
