package com.uom.lims.autoverification;

import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.entity.TestResultEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AutoverificationServiceTest {

    private final AutoverificationService service = new AutoverificationService();

    private static TestResultEntity result(ResultFlag flag, String numeric) {
        TestResultEntity r = new TestResultEntity();
        r.setFlag(flag);
        r.setResultNumeric(numeric == null ? null : new BigDecimal(numeric));
        return r;
    }

    @Test
    void autoVerifiesNormalNumericWithoutPrior() {
        assertTrue(service.decide(result(ResultFlag.NORMAL, "10.0")).autoVerify());
    }

    @Test
    void holdsCriticalAndAbnormal() {
        assertFalse(service.decide(result(ResultFlag.CRITICAL_HIGH, "99")).autoVerify());
        assertFalse(service.decide(result(ResultFlag.HIGH, "99")).autoVerify());
    }

    @Test
    void holdsNonNumeric() {
        assertFalse(service.decide(result(ResultFlag.NORMAL, null)).autoVerify());
    }

    @Test
    void holdsLargeDeltaFromPrior() {
        var decision = service.decide(result(ResultFlag.NORMAL, "20.0"), new BigDecimal("10.0")); // +100%
        assertFalse(decision.autoVerify());
        assertTrue(decision.reason().contains("Delta"));
    }

    @Test
    void autoVerifiesSmallDeltaFromPrior() {
        assertTrue(service.decide(result(ResultFlag.NORMAL, "10.5"), new BigDecimal("10.0")).autoVerify()); // +5%
    }
}
