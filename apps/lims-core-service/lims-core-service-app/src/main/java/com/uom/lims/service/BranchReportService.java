package com.uom.lims.service;

import com.uom.lims.api.dto.response.BranchReportResponse;
import com.uom.lims.repository.BranchReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BranchReportService {

    private final BranchReportRepository repository;

    private static final String[] CATEGORY_COLORS = {"#1277E1", "#a855f7", "#f59e0b", "#10b981", "#ef4444"};

    public BranchReportResponse getDashboardReport(String branchCode, Instant startDate, Instant endDate) {
        long durationInMillis = endDate.toEpochMilli() - startDate.toEpochMilli();
        Instant prevStartDate = startDate.minusMillis(durationInMillis);
        Instant prevEndDate = startDate;

        // Current Period KPIs
        long currentPatients = repository.countDistinctPatients(branchCode, startDate, endDate);
        long currentOrders = repository.countOrders(branchCode, startDate, endDate);
        long currentPending = repository.countPendingOrders(branchCode, startDate, endDate);
        BigDecimal currentRevenue = repository.sumRevenue(branchCode, startDate, endDate);

        // Previous Period KPIs
        long prevPatients = repository.countDistinctPatients(branchCode, prevStartDate, prevEndDate);
        long prevOrders = repository.countOrders(branchCode, prevStartDate, prevEndDate);
        long prevPending = repository.countPendingOrders(branchCode, prevStartDate, prevEndDate);
        BigDecimal prevRevenue = repository.sumRevenue(branchCode, prevStartDate, prevEndDate);

        // Calculate changes
        Double patientsChange = calculatePercentageChange(currentPatients, prevPatients);
        Double ordersChange = calculatePercentageChange(currentOrders, prevOrders);
        Double pendingChange = calculatePercentageChange(currentPending, prevPending);
        Double revenueChange = calculatePercentageChange(currentRevenue.doubleValue(), prevRevenue.doubleValue());

        // Trend Data
        List<BranchReportRepository.RevenueTrendProjection> trendData = repository.getRevenueTrend(branchCode, startDate, endDate);
        List<BranchReportResponse.RevenueTrend> revenueTrend = trendData.stream()
                .map(t -> BranchReportResponse.RevenueTrend.builder()
                        .date(t.getDateStr())
                        .revenue(t.getRevenue())
                        .build())
                .collect(Collectors.toList());

        // Category Data
        List<BranchReportRepository.RevenueCategoryProjection> catData = repository.getRevenueByCategory(branchCode, startDate, endDate);
        
        // Calculate total for percentages
        BigDecimal totalCatRevenue = catData.stream()
                .map(BranchReportRepository.RevenueCategoryProjection::getRevenue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<BranchReportResponse.RevenueCategory> revenueByCategory = catData.stream()
                .map(c -> {
                    double pct = totalCatRevenue.compareTo(BigDecimal.ZERO) == 0 ? 0.0 : 
                            c.getRevenue().multiply(new BigDecimal("100")).divide(totalCatRevenue, 1, RoundingMode.HALF_UP).doubleValue();
                    return BranchReportResponse.RevenueCategory.builder()
                            .name(c.getCategory())
                            .value(pct)
                            // Basic color assignment fallback, in a real system this might map to specific predefined categories
                            .color(getColorForCategory(c.getCategory()))
                            .build();
                })
                .collect(Collectors.toList());

        // Test Performance Data
        List<BranchReportRepository.TestPerformanceProjection> testPerfData = repository.getTestPerformance(branchCode, startDate, endDate);
        List<BranchReportResponse.TestPerformance> allTests = testPerfData.stream()
                .map(t -> BranchReportResponse.TestPerformance.builder()
                        .testName(t.getTestName())
                        .orderCount(t.getOrderCount())
                        .revenue(t.getRevenue())
                        .build())
                .collect(Collectors.toList());

        List<BranchReportResponse.TestPerformance> topPerformingTests = allTests.stream()
                .limit(5)
                .collect(Collectors.toList());

        List<BranchReportResponse.TestPerformance> leastPerformingTests = allTests.stream()
                .skip(Math.max(0, allTests.size() - 5))
                .sorted((t1, t2) -> t1.getOrderCount().compareTo(t2.getOrderCount())) // sort ascending
                .collect(Collectors.toList());

        return BranchReportResponse.builder()
                .kpis(BranchReportResponse.Kpi.builder()
                        .totalPatients(String.format("%,d", currentPatients))
                        .patientsChange(patientsChange)
                        .totalOrders(String.format("%,d", currentOrders))
                        .ordersChange(ordersChange)
                        .totalRevenue(formatRevenue(currentRevenue))
                        .revenueChange(revenueChange)
                        .pendingReports(String.format("%,d", currentPending))
                        .pendingReportsChange(pendingChange)
                        .build())
                .revenueTrend(revenueTrend)
                .revenueByCategory(revenueByCategory)
                .topPerformingTests(topPerformingTests)
                .leastPerformingTests(leastPerformingTests)
                .build();
    }

    private Double calculatePercentageChange(double current, double previous) {
        if (previous == 0) return current > 0 ? 100.0 : 0.0;
        double change = ((current - previous) / previous) * 100.0;
        return Math.round(change * 10.0) / 10.0;
    }

    private String formatRevenue(BigDecimal revenue) {
        if (revenue == null) return "0.0";
        return revenue.divide(new BigDecimal("1000"), 1, RoundingMode.HALF_UP).toString();
    }

    private String getColorForCategory(String category) {
        if (category == null) return "#cbd5e1";
        int hash = Math.abs(category.hashCode());
        return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
    }
}
