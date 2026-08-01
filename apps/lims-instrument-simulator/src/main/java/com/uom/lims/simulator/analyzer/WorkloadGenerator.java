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

    /**
     * Matches {@code ReferenceNumberGenerator.generateBarcode()} in the core
     * service: {@code DH-{yyyyMMdd}-{00000001}}. The simulator's own default
     * layout ({@code S20260801-00001}) never matches a barcode LIMS issued, so
     * every result it sends is dropped by
     * {@code InstrumentResultIngestionService} with "no sample for barcode".
     */
    private static final String LIMS_BARCODE_FORMAT = "%1$s-%2$tY%2$tm%2$td-%3$08d";

    private final Random rnd;
    private final double abnormalBias;
    private final List<String> sampleIds;
    private final String barcodePrefix;
    private long sequence;

    /**
     * @param seed         fixed seed for reproducible demos (use a time-based
     *                     seed for varied data)
     * @param abnormalBias 0.0-1.0 — probability weight toward abnormal/critical
     *                     values
     */
    public WorkloadGenerator(long seed, double abnormalBias) {
        this(seed, abnormalBias, List.of(), null);
    }

    /**
     * @param sampleIds     explicit barcodes to emit, cycled in order. Use this
     *                      to send results for specimens that actually exist in
     *                      LIMS — copy the barcodes off the accessioning screen.
     *                      Empty to generate ids instead.
     * @param barcodePrefix when generating, produce LIMS-shaped barcodes with
     *                      this prefix (normally {@code DH}) so a run against a
     *                      freshly seeded database lines up with the barcodes
     *                      LIMS issued the same day. Null for the simulator's
     *                      own {@code S…} layout.
     */
    public WorkloadGenerator(long seed, double abnormalBias, List<String> sampleIds, String barcodePrefix) {
        this.rnd = new Random(seed);
        this.abnormalBias = Math.max(0.0, Math.min(1.0, abnormalBias));
        this.sampleIds = sampleIds == null ? List.of() : List.copyOf(sampleIds);
        this.barcodePrefix = (barcodePrefix == null || barcodePrefix.isBlank()) ? null : barcodePrefix.trim();
    }

    public SimulatedSample next(AnalyzerProfile profile) {
        sequence++;
        String sampleId = nextSampleId();
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

    private String nextSampleId() {
        if (!sampleIds.isEmpty()) {
            // Cycle rather than stop, so --count may exceed the number of ids
            // supplied; re-sending a barcode exercises the ingestion path's
            // idempotency.
            return sampleIds.get((int) ((sequence - 1) % sampleIds.size()));
        }
        if (barcodePrefix != null) {
            return String.format(LIMS_BARCODE_FORMAT, barcodePrefix, LocalDate.now(), sequence);
        }
        return String.format("S%1$tY%1$tm%1$td-%2$05d", LocalDate.now(), (int) (sequence % 100000));
    }
}
