package com.uom.lims.service;

import com.uom.lims.api.dto.response.OrdersBillingStatsResponse;
import com.uom.lims.api.dto.response.PhlebotomyStatsResponse;
import com.uom.lims.api.enums.PaymentStatus;
import com.uom.lims.api.enums.Priority;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.entity.BillEntity;
import com.uom.lims.repository.BillRepository;
import com.uom.lims.repository.OrderRepository;
import com.uom.lims.repository.PaymentRepository;
import com.uom.lims.repository.SampleRepository;
import com.uom.lims.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * WHY: Dashboard statistics are read-only aggregations consumed by the management
 * and receptionist dashboards. Isolating them in a dedicated service prevents tight
 * coupling between the dashboard query logic and the mutable order/billing/sample services.
 * All methods are readOnly = true to prevent accidental writes and allow database
 * query optimisations (e.g. read replicas, connection pool routing).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StatisticsService {

    // WHY: Sri Lanka Standard Time (UTC+5:30) is used for all "today" boundary calculations
    // so that midnight rolls over at the correct local time, not UTC midnight.
    private static final ZoneId LIMS_TIMEZONE = ZoneId.of("Asia/Colombo");

    private final OrderRepository orderRepository;
    private final BillRepository billRepository;
    private final SampleRepository sampleRepository;
    private final PaymentRepository paymentRepository;

    /**
     * WHY: The orders and billing stat card on the management dashboard requires
     * four counters and a trend indicator. Computing them in one service call
     * minimises the number of database round-trips from the controller layer.
     * Trend is formatted as a signed percentage string (e.g. "+8%" or "-3%")
     * so the frontend can display it without any further transformation.
     *
     * @return OrdersBillingStatsResponse aggregating today's operational metrics
     */
    public OrdersBillingStatsResponse getOrdersBillingStats() {
        Instant[] todayBounds = todayBounds();
        Instant[] yesterdayBounds = yesterdayBounds();
        // Tenant isolation: branch users see only their branch's metrics.
        String scope = SecurityUtils.resolveBranchScope();

        long testOrdersToday = orderRepository.countCreatedBetweenInBranch(
                todayBounds[0], todayBounds[1], scope);
        long yesterdayOrders = orderRepository.countCreatedBetweenInBranch(
                yesterdayBounds[0], yesterdayBounds[1], scope);

        List<BillEntity> pendingBills = billRepository.findByPaymentStatusInBranch(PaymentStatus.PENDING, scope);
        long pendingPayments = pendingBills.size();
        long partialPayments = pendingBills.stream()
                .filter(bill -> bill.getPaidAmount() != null
                        && bill.getTotalAmount() != null
                        && bill.getPaidAmount().compareTo(BigDecimal.ZERO) > 0
                        && bill.getPaidAmount().compareTo(bill.getTotalAmount()) < 0)
                .count();

        // WHY: Revenue today is the sum of all non-reversed payments received today.
        BigDecimal totalRevenueToday = paymentRepository
                .findReceivedInBranch(todayBounds[0], todayBounds[1], scope)
                .stream()
                .map(p -> p.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // WHY: Trend is expressed as signed integer percentage relative to yesterday's
        // count.  Edge case: if yesterday had 0 orders we return "+100%" for any
        // positive today count, or "0%" if both are zero.
        String trend = computeTrend(testOrdersToday, yesterdayOrders);

        return OrdersBillingStatsResponse.builder()
                .testOrdersToday(testOrdersToday)
                .pendingPayments(pendingPayments)
                .overduePayments(pendingPayments)
                .partialPayments(partialPayments)
                .totalRevenueToday(totalRevenueToday)
                .trend(trend)
                .build();
    }

    /**
     * WHY: The phlebotomy dashboard requires a real-time view of pending work.
     * pendingCollections drives the total queue size badge.
     * urgentSamples drives the urgent alert banner — STAT and URGENT tubes must
     * be processed ahead of NORMAL priority samples per clinical protocol.
     * collectedToday and rejections give the supervisor throughput and quality metrics.
     *
     * @return PhlebotomyStatsResponse aggregating current collection queue metrics
     */
    public PhlebotomyStatsResponse getPhlebotomyStats() {
        Instant[] todayBounds = todayBounds();
        String scope = SecurityUtils.resolveBranchScope();
        List<SampleStatus> actionableStatuses = List.of(
                SampleStatus.PENDING_COLLECTION,
                SampleStatus.RECOLLECTION_REQUIRED);

        List<com.uom.lims.entity.SampleEntity> actionable =
                sampleRepository.findByStatusInAndBranchList(actionableStatuses, scope);

        long pendingCollections = actionable.stream()
                .filter(s -> s.getOrderItem() != null
                        && s.getOrderItem().getOrder() != null
                        && s.getOrderItem().getOrder().getBill() != null
                        && s.getOrderItem().getOrder().getBill().getPaymentStatus() == PaymentStatus.PAID)
                .count();

        // WHY: STAT and URGENT samples are counted together because both require
        // expedited processing — only NORMAL samples can be queued in standard order.
        long urgentSamples = actionable.stream()
                .filter(s -> s.getOrderItem() != null
                        && s.getOrderItem().getOrder() != null
                        && s.getOrderItem().getOrder().getBill() != null
                        && s.getOrderItem().getOrder().getBill().getPaymentStatus() == PaymentStatus.PAID)
                .filter(s -> s.getPriority() == Priority.STAT || s.getPriority() == Priority.URGENT)
                .count();

        long collectedToday = sampleRepository.countByStatusAndCollectedBetweenInBranch(
                SampleStatus.COLLECTED, todayBounds[0], todayBounds[1], scope);

        long rejections = sampleRepository.countByStatusInBranch(SampleStatus.REJECTED, scope);

        return PhlebotomyStatsResponse.builder()
                .pendingCollections(pendingCollections)
                .urgentSamples(urgentSamples)
                .collectedToday(collectedToday)
                .rejections(rejections)
                .build();
    }

    /**
     * WHY: Boundary calculations use Asia/Colombo timezone (UTC+5:30) so "today"
     * runs from 00:00:00 local time to "now", matching what hospital staff expect.
     * Returning an Instant array [start, end] keeps the method reusable for both
     * today and yesterday without extra parameters.
     *
     * @return two-element Instant array: [startOfToday, now]
     */
    private Instant[] todayBounds() {
        ZonedDateTime startOfToday = ZonedDateTime.now(LIMS_TIMEZONE).toLocalDate()
                .atStartOfDay(LIMS_TIMEZONE);
        return new Instant[]{startOfToday.toInstant(), Instant.now()};
    }

    /**
     * WHY: Yesterday's bounds are used for trend calculation — isolating
     * this avoids duplicating the timezone-aware date arithmetic inline.
     *
     * @return two-element Instant array: [startOfYesterday, startOfToday]
     */
    private Instant[] yesterdayBounds() {
        ZonedDateTime startOfToday = ZonedDateTime.now(LIMS_TIMEZONE).toLocalDate()
                .atStartOfDay(LIMS_TIMEZONE);
        ZonedDateTime startOfYesterday = startOfToday.minusDays(1);
        return new Instant[]{startOfYesterday.toInstant(), startOfToday.toInstant()};
    }

    /**
     * WHY: The trend string is computed here rather than in the controller or frontend
     * to keep presentation logic server-side — the frontend can simply display the
     * string value. Signed integer format (+8%, -3%, 0%) is unambiguous and compact.
     *
     * @param today     today's order count
     * @param yesterday yesterday's order count
     * @return signed percentage trend string, e.g. "+8%", "-3%", or "0%"
     */
    private String computeTrend(long today, long yesterday) {
        if (yesterday == 0) {
            return today > 0 ? "+100%" : "0%";
        }
        long percentChange = Math.round(
                BigDecimal.valueOf(today - yesterday)
                        .divide(BigDecimal.valueOf(yesterday), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .doubleValue());
        return (percentChange >= 0 ? "+" : "") + percentChange + "%";
    }
}
