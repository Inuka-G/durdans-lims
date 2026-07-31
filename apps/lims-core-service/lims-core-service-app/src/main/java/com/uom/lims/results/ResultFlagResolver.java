package com.uom.lims.results;

import com.uom.lims.api.enums.ResultFlag;

import java.math.BigDecimal;

/**
 * Derives a result flag from configured thresholds (panic limits first, then the
 * reference interval), and combines flags by clinical severity. Shared so the
 * manual and instrument result paths apply the SAME critical-value policy — an
 * analyzer's own flag must never be the sole gate for auto-release.
 */
public final class ResultFlagResolver {

    private ResultFlagResolver() {
    }

    /** Flag from thresholds; null if the value is null or no reference bound is configured. */
    public static ResultFlag fromThresholds(BigDecimal value, BigDecimal refLow, BigDecimal refHigh,
                                            BigDecimal criticalLow, BigDecimal criticalHigh) {
        if (value == null) {
            return null;
        }
        if (criticalLow != null && value.compareTo(criticalLow) <= 0) {
            return ResultFlag.CRITICAL_LOW;
        }
        if (criticalHigh != null && value.compareTo(criticalHigh) >= 0) {
            return ResultFlag.CRITICAL_HIGH;
        }
        if (refLow != null && value.compareTo(refLow) < 0) {
            return ResultFlag.LOW;
        }
        if (refHigh != null && value.compareTo(refHigh) > 0) {
            return ResultFlag.HIGH;
        }
        if (refLow != null || refHigh != null) {
            return ResultFlag.NORMAL;
        }
        return null;
    }

    /** The more clinically severe of two flags (criticals &gt; abnormal &gt; normal &gt; null). */
    public static ResultFlag moreSevere(ResultFlag a, ResultFlag b) {
        return severity(a) >= severity(b) ? a : b;
    }

    private static int severity(ResultFlag f) {
        if (f == null) {
            return -1;
        }
        return switch (f) {
            case CRITICAL_HIGH, CRITICAL_LOW -> 3;
            case HIGH, LOW -> 2;
            case NORMAL -> 1;
        };
    }
}
