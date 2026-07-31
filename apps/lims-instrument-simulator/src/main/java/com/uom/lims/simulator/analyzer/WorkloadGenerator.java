package com.uom.lims.simulator.analyzer;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Produces dummy patients, specimens and measured results for a given analyzer
 * profile. Sample ids use a barcode-like layout so the receiving middleware can
 * be exercised exactly as it would with a real labelled tube.
 */
public final class WorkloadGenerator {

    private static final String[] LAST_NAMES = {
            "Perera", "Fernando", "Silva", "Jayawardena", "Bandara",
            "Wickramasinghe", "Rajapaksa", "Gunasekara", "Dissanayake", "Senanayake"
    };
    private static final String[] FIRST_NAMES = {
            "Nimal", "Kamala", "Sunil", "Anusha", "Ruwan",
            "Dilani", "Chathura", "Iresha", "Saman", "Tharindu"
    };

    private final Random rnd;
    private final double abnormalBias;
    private long sequence;

    /**
     * @param seed         fixed seed for reproducible demos (use a time-based
     *                     seed for varied data)
     * @param abnormalBias 0.0-1.0 — probability weight toward abnormal/critical
     *                     values
     */
    public WorkloadGenerator(long seed, double abnormalBias) {
        this.rnd = new Random(seed);
        this.abnormalBias = Math.max(0.0, Math.min(1.0, abnormalBias));
    }

    public SimulatedSample next(AnalyzerProfile profile) {
        sequence++;
        String sampleId = String.format("S%1$tY%1$tm%1$td-%2$05d", LocalDate.now(), (int) (sequence % 100000));
        String patientId = String.format("PAT%05d", 1 + rnd.nextInt(99999));
        String last = LAST_NAMES[rnd.nextInt(LAST_NAMES.length)];
        String first = FIRST_NAMES[rnd.nextInt(FIRST_NAMES.length)];
        String sex = rnd.nextBoolean() ? "M" : "F";
        String dob = String.format("%04d%02d%02d",
                1945 + rnd.nextInt(75), 1 + rnd.nextInt(12), 1 + rnd.nextInt(28));
        String priority = rnd.nextInt(10) == 0 ? "S" : "R"; // ~10% STAT

        List<SimulatedSample.Measurement> measurements = new ArrayList<>();
        for (Analyte analyte : profile.analytes()) {
            double value = analyte.sample(rnd, abnormalBias);
            measurements.add(new SimulatedSample.Measurement(analyte, value, analyte.flagFor(value)));
        }
        return new SimulatedSample(sampleId, patientId, last, first, dob, sex, priority, measurements);
    }
}
