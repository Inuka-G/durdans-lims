package com.uom.lims.catalog;

import com.uom.lims.api.enums.TubeType;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestPackageEntity;
import com.uom.lims.entity.TestPackageItemEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The values a patient is actually quoted for a package are derived, not stored. These
 * are the rules behind those numbers.
 */
class TestPackageDerivationTest {

    private static TestCatalogEntity test(String code, String price, Integer tatHours,
                                          boolean fasting, Integer fastingHours) {
        TestCatalogEntity t = new TestCatalogEntity();
        t.setTestCode(code);
        t.setTestName(code);
        t.setCategory("Biochemistry");
        t.setPrice(new BigDecimal(price));
        t.setSampleType("Serum");
        t.setTubeType(TubeType.SST_GOLD);
        t.setTurnAroundTimeHours(tatHours);
        t.setFastingRequired(fasting);
        t.setFastingHours(fastingHours);
        return t;
    }

    private static TestPackageEntity packageOf(String price, TestCatalogEntity... tests) {
        TestPackageEntity pkg = new TestPackageEntity();
        pkg.setPackageCode("PKG-X");
        pkg.setPackageName("Package X");
        pkg.setPrice(new BigDecimal(price));
        int order = 0;
        for (TestCatalogEntity t : tests) {
            TestPackageItemEntity item = new TestPackageItemEntity();
            item.setTestPackage(pkg);
            item.setTest(t);
            item.setDisplayOrder(order++);
            pkg.getItems().add(item);
        }
        return pkg;
    }

    @Test
    void savingIsTheDifferenceBetweenTheBundleAndItsParts() {
        TestPackageEntity pkg = packageOf("3000.00",
                test("GLU", "900.00", 4, false, null),
                test("HBA1C", "2600.00", 8, false, null));

        assertThat(pkg.individualTotal()).isEqualByComparingTo("3500.00");
        assertThat(pkg.saving()).isEqualByComparingTo("500.00");
    }

    /**
     * A package priced above its parts is a pricing mistake, but showing a patient a
     * negative saving would be a worse one.
     */
    @Test
    void savingNeverGoesNegative() {
        TestPackageEntity pkg = packageOf("5000.00",
                test("GLU", "900.00", 4, false, null));

        assertThat(pkg.saving()).isEqualByComparingTo("0.00");
    }

    /**
     * The strictest fasting requirement wins. Telling a patient "8 hours" for a bundle
     * containing a 12-hour test gets the sample rejected and the visit wasted.
     */
    @Test
    void fastingIsTheLongestAnyComponentDemands() {
        TestPackageEntity pkg = packageOf("4000.00",
                test("GLU", "900.00", 4, true, 8),
                test("LIPID", "3200.00", 8, true, 12),
                test("FBC", "1200.00", 4, false, null));

        assertThat(pkg.fastingRequired()).isTrue();
        assertThat(pkg.fastingHours()).isEqualTo(12);
    }

    @Test
    void noFastingWhenNoComponentNeedsIt() {
        TestPackageEntity pkg = packageOf("2000.00",
                test("FBC", "1200.00", 4, false, null),
                test("ESR", "900.00", 4, false, null));

        assertThat(pkg.fastingRequired()).isFalse();
        assertThat(pkg.fastingHours()).isNull();
    }

    /** The slowest component decides when the whole package is ready. */
    @Test
    void turnaroundIsTheSlowestComponent() {
        TestPackageEntity pkg = packageOf("4000.00",
                test("FBC", "1200.00", 4, false, null),
                test("LIPID", "3200.00", 8, false, null),
                test("HBA1C", "2600.00", 24, false, null));

        assertThat(pkg.turnAroundTimeHours()).isEqualTo(24);
    }

    @Test
    void anEmptyPackageHasNoDerivedValues() {
        TestPackageEntity pkg = packageOf("0.00");

        assertThat(pkg.individualTotal()).isEqualByComparingTo("0.00");
        assertThat(pkg.saving()).isEqualByComparingTo("0.00");
        assertThat(pkg.fastingRequired()).isFalse();
        assertThat(pkg.turnAroundTimeHours()).isNull();
    }
}
