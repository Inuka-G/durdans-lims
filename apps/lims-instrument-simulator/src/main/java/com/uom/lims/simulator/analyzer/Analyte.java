package com.uom.lims.simulator.analyzer;

import java.util.Random;

/**
 * A measurable analyte with the data a real analyzer driver needs to map into
 * the LIS: the device test code, a LOINC code (for the middleware to translate
 * to the LIS test catalogue), units, the reference interval and the critical
 * (panic) limits used to derive abnormal flags.
 */
public record Analyte(
        String deviceCode,
        String name,
        String loinc,
        String unit,
        double refLow,
        double refHigh,
        double criticalLow,
        double criticalHigh,
        int decimals) {

    /** Reference range as it appears in an ASTM R record, e.g. {@code "4.0 to 11.0"}. */
    public String referenceRange() {
        return format(refLow) + " to " + format(refHigh);
    }

    public String format(double value) {
        return String.format("%." + decimals + "f", value);
    }

    /**
     * Generate one realistic measurement. {@code abnormalBias} (0.0-1.0) raises
     * the chance of producing an out-of-range / critical value so the LIS
     * critical-value and delta-check workflows can be exercised.
     */
    public double sample(Random rnd, double abnormalBias) {
        double roll = rnd.nextDouble();
        double span = refHigh - refLow;

        if (roll < abnormalBias * 0.25) {
            // Critical value (low or high)
            return rnd.nextBoolean()
                    ? round(criticalLow - rnd.nextDouble() * span * 0.3)
                    : round(criticalHigh + rnd.nextDouble() * span * 0.3);
        }
        if (roll < abnormalBias) {
            // Mildly abnormal (just outside the reference interval)
            return rnd.nextBoolean()
                    ? round(refLow - rnd.nextDouble() * span * 0.25)
                    : round(refHigh + rnd.nextDouble() * span * 0.25);
        }
        // Normal: centred in the interval with gentle spread
        double mean = (refLow + refHigh) / 2.0;
        double value = mean + (rnd.nextGaussian() * span / 6.0);
        value = Math.max(refLow, Math.min(refHigh, value));
        return round(value);
    }

    /** ASTM abnormal flag for a measured value. */
    public String flagFor(double value) {
        if (value <= criticalLow) {
            return "LL";
        }
        if (value >= criticalHigh) {
            return "HH";
        }
        if (value < refLow) {
            return "L";
        }
        if (value > refHigh) {
            return "H";
        }
        return "N";
    }

    private double round(double v) {
        double factor = Math.pow(10, decimals);
        return Math.round(v * factor) / factor;
    }
}
