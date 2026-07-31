package com.uom.lims.autoverification;

import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.entity.TestResultEntity;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Autoverification policy (CLSI AUTO10/AUTO15 style). Conservative by design:
 * only a normal, numeric, in-range result is eligible for automatic release;
 * anything abnormal, critical or non-numeric is held for a human verifier.
 *
 * <p>This is the decision point the instrument-ingestion path consults so that
 * routine normal results flow through without manual entry while exceptions are
 * surfaced for review (review-by-exception).
 */
@Service
public class AutoverificationService {

    public record Decision(boolean autoVerify, String reason) {
    }

    /** Percent change from the patient's prior result that holds for manual review. */
    private static final double DELTA_THRESHOLD_PCT = 40.0;

    public Decision decide(TestResultEntity result) {
        return decide(result, null);
    }

    /**
     * @param priorNumeric the patient's most recent prior numeric result for this
     *                     parameter, or null if none (then no delta check applies)
     */
    public Decision decide(TestResultEntity result, BigDecimal priorNumeric) {
        ResultFlag flag = result.getFlag();

        if (flag == ResultFlag.CRITICAL_LOW || flag == ResultFlag.CRITICAL_HIGH) {
            return new Decision(false, "Critical value — requires manual review and notification");
        }
        if (flag == ResultFlag.LOW || flag == ResultFlag.HIGH) {
            return new Decision(false, "Abnormal result — held for manual verification");
        }
        if (result.getResultNumeric() == null) {
            return new Decision(false, "Non-numeric result — held for manual review");
        }
        // Delta check: a large change from the patient's prior result can signal a
        // mislabelled specimen or a genuine clinical change — hold for review.
        if (priorNumeric != null && priorNumeric.signum() != 0) {
            double deltaPct = result.getResultNumeric().subtract(priorNumeric).abs()
                    .divide(priorNumeric.abs(), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).doubleValue();
            if (deltaPct > DELTA_THRESHOLD_PCT) {
                return new Decision(false,
                        String.format("Delta check: %.0f%% change vs previous — held", deltaPct));
            }
        }
        return new Decision(true, "Normal numeric result within reference range — auto-released");
    }
}
