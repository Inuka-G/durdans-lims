package com.uom.lims.qc;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Evaluates a quality-control measurement against the classic Westgard multirules
 * on a single control level (mean +/- SD). Returns the violated rules and whether
 * the run should be rejected. This is the analytic core of internal QC; a QC data
 * model + Levey-Jennings UI build on top of it.
 *
 * Rules: 1-3s and 2-2s, R-4s, 4-1s, 10x are rejection rules; 1-2s is a warning.
 */
public final class WestgardEvaluator {

    private WestgardEvaluator() {
    }

    public record Evaluation(List<String> violations, boolean rejected) {
    }

    /**
     * @param value   the current control measurement
     * @param mean    established control mean
     * @param sd      established control SD (must be &gt; 0)
     * @param history prior measurements for this control, oldest first (current excluded)
     */
    public static Evaluation evaluate(double value, double mean, double sd, List<Double> history) {
        if (sd <= 0) {
            throw new IllegalArgumentException("SD must be positive");
        }
        List<Double> series = new ArrayList<>(history == null ? List.of() : history);
        series.add(value);
        List<Double> z = series.stream().map(v -> (v - mean) / sd).toList();
        double current = z.get(z.size() - 1);

        Set<String> violations = new LinkedHashSet<>();
        boolean reject = false;

        if (Math.abs(current) > 3.0) {
            violations.add("1-3s");
            reject = true;
        }
        if (Math.abs(current) > 2.0) {
            violations.add("1-2s"); // warning
        }
        if (z.size() >= 2 && lastNSameSideBeyond(z, 2, 2.0)) {
            violations.add("2-2s");
            reject = true;
        }
        if (z.size() >= 2) {
            double a = z.get(z.size() - 1);
            double b = z.get(z.size() - 2);
            if (Math.abs(a - b) > 4.0) {
                violations.add("R-4s");
                reject = true;
            }
        }
        if (z.size() >= 4 && lastNSameSideBeyond(z, 4, 1.0)) {
            violations.add("4-1s");
            reject = true;
        }
        if (z.size() >= 10 && lastNSameSideOfMean(z, 10)) {
            violations.add("10x");
            reject = true;
        }

        return new Evaluation(new ArrayList<>(violations), reject);
    }

    /** True if the last n z-scores are all &gt; +t, or all &lt; -t. */
    private static boolean lastNSameSideBeyond(List<Double> z, int n, double t) {
        int from = z.size() - n;
        boolean allHigh = true;
        boolean allLow = true;
        for (int i = from; i < z.size(); i++) {
            if (z.get(i) <= t) {
                allHigh = false;
            }
            if (z.get(i) >= -t) {
                allLow = false;
            }
        }
        return allHigh || allLow;
    }

    /** True if the last n z-scores are all positive, or all negative. */
    private static boolean lastNSameSideOfMean(List<Double> z, int n) {
        int from = z.size() - n;
        boolean allPos = true;
        boolean allNeg = true;
        for (int i = from; i < z.size(); i++) {
            if (z.get(i) <= 0) {
                allPos = false;
            }
            if (z.get(i) >= 0) {
                allNeg = false;
            }
        }
        return allPos || allNeg;
    }
}
