package com.uom.lims.refrange;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ReferenceRangeMatcherTest {

    private static ReferenceRangeEntity range(String sex, Integer ageLow, Integer ageHigh, String low, String high) {
        ReferenceRangeEntity r = new ReferenceRangeEntity();
        r.setSex(sex);
        r.setAgeLowYears(ageLow);
        r.setAgeHighYears(ageHigh);
        r.setRefLow(new BigDecimal(low));
        r.setRefHigh(new BigDecimal(high));
        return r;
    }

    private final List<ReferenceRangeEntity> hb = List.of(
            range("M", 18, null, "13.0", "17.0"),
            range("F", 18, null, "12.0", "15.5"),
            range("ANY", 0, 18, "11.0", "14.0"));

    @Test
    void picksSexSpecificAdultRange() {
        assertEquals(new BigDecimal("17.0"), ReferenceRangeMatcher.match(hb, "M", 30).getRefHigh());
        assertEquals(new BigDecimal("15.5"), ReferenceRangeMatcher.match(hb, "F", 30).getRefHigh());
    }

    @Test
    void picksPaediatricAnyRangeForChild() {
        ReferenceRangeEntity r = ReferenceRangeMatcher.match(hb, "M", 10);
        assertEquals(new BigDecimal("14.0"), r.getRefHigh());
    }

    @Test
    void noMatchWhenAgeOutsideAllBands() {
        // A 30yo with no sex falls through (no ANY range covers adults here).
        assertNull(ReferenceRangeMatcher.match(hb, null, 30));
    }
}
