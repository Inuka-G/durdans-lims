package com.uom.lims.instrument.astm;

import java.util.ArrayList;
import java.util.List;

/**
 * Parses a list of ASTM E1394 record strings (H/P/O/R/...) into the fields the
 * ingestion pipeline needs: the specimen id and the measured results.
 */
public final class AstmMessage {

    private AstmMessage() {
    }

    /** One analyzer result line (R record). */
    public record Result(String deviceCode, String testName, String value, String unit, String flag) {
    }

    /** One ordered specimen (O record) with its results. */
    public record SpecimenResults(String sampleId, List<Result> results) {
    }

    /**
     * Group results under the most recent preceding O record's specimen id.
     * Most analyzer messages contain one specimen; this also handles batches.
     */
    public static List<SpecimenResults> parse(List<String> records) {
        List<SpecimenResults> specimens = new ArrayList<>();
        String currentSampleId = null;
        List<Result> currentResults = new ArrayList<>();

        for (String record : records) {
            String[] f = record.split("\\|", -1);
            if (f.length == 0 || f[0].isEmpty()) {
                continue;
            }
            char type = f[0].charAt(0);
            if (type == 'O') {
                if (currentSampleId != null) {
                    specimens.add(new SpecimenResults(currentSampleId, currentResults));
                    currentResults = new ArrayList<>();
                }
                currentSampleId = field(f, 2);
            } else if (type == 'R') {
                String[] testId = field(f, 2).split("\\^", -1);
                String deviceCode = testId.length >= 4 ? testId[3] : "";
                String testName = testId.length >= 5 ? testId[4] : "";
                currentResults.add(new Result(deviceCode, testName, field(f, 3), field(f, 4), field(f, 6)));
            }
        }
        if (currentSampleId != null) {
            specimens.add(new SpecimenResults(currentSampleId, currentResults));
        }
        return specimens;
    }

    private static String field(String[] f, int i) {
        return i < f.length ? f[i] : "";
    }
}
