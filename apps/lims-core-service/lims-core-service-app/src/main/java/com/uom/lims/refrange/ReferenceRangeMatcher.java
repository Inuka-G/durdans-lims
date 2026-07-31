package com.uom.lims.refrange;

import java.util.List;

/**
 * Selects the applicable reference interval for a patient from a parameter's
 * banded ranges. A sex-specific match is preferred over an ANY-sex match; among
 * candidates the first matching age band wins.
 */
public final class ReferenceRangeMatcher {

    private ReferenceRangeMatcher() {
    }

    public static ReferenceRangeEntity match(List<ReferenceRangeEntity> ranges, String sex, Integer ageYears) {
        if (ranges == null || ranges.isEmpty()) {
            return null;
        }
        ReferenceRangeEntity anyMatch = null;
        for (ReferenceRangeEntity r : ranges) {
            if (!ageInBand(r, ageYears)) {
                continue;
            }
            if (sex != null && sex.equalsIgnoreCase(r.getSex())) {
                return r; // sex-specific — best match
            }
            if ("ANY".equalsIgnoreCase(r.getSex()) && anyMatch == null) {
                anyMatch = r;
            }
        }
        return anyMatch;
    }

    private static boolean ageInBand(ReferenceRangeEntity r, Integer ageYears) {
        if (ageYears == null) {
            // No age available — only ranges with no age bounds apply.
            return r.getAgeLowYears() == null && r.getAgeHighYears() == null;
        }
        boolean aboveLow = r.getAgeLowYears() == null || ageYears >= r.getAgeLowYears();
        boolean belowHigh = r.getAgeHighYears() == null || ageYears < r.getAgeHighYears();
        return aboveLow && belowHigh;
    }
}
