package com.uom.lims.api.catalog.dto.response;

import java.util.List;

/**
 * How much of the catalogue has a signed-off translation in one language, and which
 * tests are still missing one.
 *
 * <p>This exists because translation coverage is the schedule critical path for the
 * patient-facing agent, and it is the kind of work that stalls invisibly. A number the
 * project can look at every morning is the difference between finding out in week two
 * and finding out in week nine.
 */
public record TranslationCoverageResponse(
        String locale,
        long totalActiveTests,
        long reviewedTests,
        long draftTests,
        int percentComplete,
        List<String> missingTestCodes) {
}
