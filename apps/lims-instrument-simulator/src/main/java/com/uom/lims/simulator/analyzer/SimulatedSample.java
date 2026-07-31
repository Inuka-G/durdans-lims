package com.uom.lims.simulator.analyzer;

import java.util.List;

/** A dummy patient + specimen + the measured analyte values for one run. */
public record SimulatedSample(
        String sampleId,
        String patientId,
        String lastName,
        String firstName,
        String dob,
        String sex,
        String priority,
        List<Measurement> measurements) {

    /** One analyte measurement with its derived abnormal flag. */
    public record Measurement(Analyte analyte, double value, String flag) {
        public boolean isCritical() {
            return "LL".equals(flag) || "HH".equals(flag);
        }
    }

    public boolean hasCritical() {
        return measurements.stream().anyMatch(Measurement::isCritical);
    }
}
