package com.uom.lims.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * WHY: Billing parameters such as service charge percentage and overdue thresholds
 * are business rules, not code logic. Externalising them into application.yml means
 * the finance team can adjust rates without triggering a code release or rebuild.
 * All fields map directly to the 'app.billing.*' namespace in application.yml.
 */
@Component
@ConfigurationProperties(prefix = "app.billing")
public class BillingProperties {

    /**
     * WHY: The service charge percentage applied on top of the test total.
     * Stored as BigDecimal to avoid floating-point precision errors in
     * monetary calculations (e.g., 5.00% not 4.999999%).
     * Maps to: app.billing.service-charge-percentage
     */
    private BigDecimal serviceChargePercentage;

    /**
     * WHY: The number of hours after bill creation before payment status
     * transitions from PENDING to OVERDUE. Using hours (not days) gives
     * the billing module finer control for same-day payment scenarios.
     * Maps to: app.billing.overdue-threshold-hours
     */
    private long overdueThresholdHours;

    public BigDecimal getServiceChargePercentage() {
        return serviceChargePercentage;
    }

    public void setServiceChargePercentage(BigDecimal serviceChargePercentage) {
        this.serviceChargePercentage = serviceChargePercentage;
    }

    public long getOverdueThresholdHours() {
        return overdueThresholdHours;
    }

    public void setOverdueThresholdHours(long overdueThresholdHours) {
        this.overdueThresholdHours = overdueThresholdHours;
    }
}
