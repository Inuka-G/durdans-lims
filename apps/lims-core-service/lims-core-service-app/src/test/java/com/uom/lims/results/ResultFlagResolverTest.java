package com.uom.lims.results;

import com.uom.lims.api.enums.ResultFlag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ResultFlagResolverTest {

    // Potassium-like: ref 3.5-5.1, critical 2.8 / 6.2
    private static final BigDecimal REF_LO = new BigDecimal("3.5");
    private static final BigDecimal REF_HI = new BigDecimal("5.1");
    private static final BigDecimal CRIT_LO = new BigDecimal("2.8");
    private static final BigDecimal CRIT_HI = new BigDecimal("6.2");

    private static ResultFlag flag(String value) {
        return ResultFlagResolver.fromThresholds(new BigDecimal(value), REF_LO, REF_HI, CRIT_LO, CRIT_HI);
    }

    @Test
    void thresholdsDriveTheFlag() {
        assertEquals(ResultFlag.CRITICAL_HIGH, flag("6.5"));   // >= crit high
        assertEquals(ResultFlag.CRITICAL_LOW, flag("2.5"));    // <= crit low
        assertEquals(ResultFlag.HIGH, flag("5.5"));            // > ref high, < crit high
        assertEquals(ResultFlag.LOW, flag("3.0"));             // < ref low, > crit low
        assertEquals(ResultFlag.NORMAL, flag("4.2"));          // in range
    }

    @Test
    void nullValueOrNoBoundsYieldsNull() {
        assertNull(ResultFlagResolver.fromThresholds(null, REF_LO, REF_HI, CRIT_LO, CRIT_HI));
        assertNull(ResultFlagResolver.fromThresholds(new BigDecimal("1"), null, null, null, null));
    }

    @Test
    void moreSevereWins() {
        // The key clinical-safety property: a critical from thresholds overrides a
        // benign analyzer flag (and vice-versa), and null never masks a real flag.
        assertEquals(ResultFlag.CRITICAL_HIGH,
                ResultFlagResolver.moreSevere(ResultFlag.NORMAL, ResultFlag.CRITICAL_HIGH));
        assertEquals(ResultFlag.CRITICAL_LOW,
                ResultFlagResolver.moreSevere(ResultFlag.HIGH, ResultFlag.CRITICAL_LOW));
        assertEquals(ResultFlag.LOW,
                ResultFlagResolver.moreSevere(null, ResultFlag.LOW));
    }
}
