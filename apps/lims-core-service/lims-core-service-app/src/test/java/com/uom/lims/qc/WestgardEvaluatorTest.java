package com.uom.lims.qc;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WestgardEvaluatorTest {

    private static final double MEAN = 100.0;
    private static final double SD = 10.0;

    @Test
    void inControlValuePasses() {
        var e = WestgardEvaluator.evaluate(105.0, MEAN, SD, List.of()); // z = 0.5
        assertTrue(e.violations().isEmpty());
        assertFalse(e.rejected());
    }

    @Test
    void oneThreeSRejects() {
        var e = WestgardEvaluator.evaluate(137.0, MEAN, SD, List.of()); // z = 3.7
        assertTrue(e.violations().contains("1-3s"));
        assertTrue(e.rejected());
    }

    @Test
    void twoTwoSRejectsOnConsecutiveSameSide() {
        var e = WestgardEvaluator.evaluate(126.0, MEAN, SD, List.of(125.0)); // z 2.5, 2.6
        assertTrue(e.violations().contains("2-2s"));
        assertTrue(e.rejected());
    }

    @Test
    void rFourSRejectsOnSpread() {
        var e = WestgardEvaluator.evaluate(74.0, MEAN, SD, List.of(125.0)); // z -2.6 vs +2.5, range 5.1
        assertTrue(e.violations().contains("R-4s"));
        assertTrue(e.rejected());
    }

    @Test
    void tenXRejectsOnTrend() {
        // 9 prior points just above the mean, plus a 10th — all same side.
        var e = WestgardEvaluator.evaluate(102.0, MEAN, SD,
                List.of(101.0, 101.0, 101.0, 101.0, 101.0, 101.0, 101.0, 101.0, 101.0));
        assertTrue(e.violations().contains("10x"));
        assertTrue(e.rejected());
    }
}
