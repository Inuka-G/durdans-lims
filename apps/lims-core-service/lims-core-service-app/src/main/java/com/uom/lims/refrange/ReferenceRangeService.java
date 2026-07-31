package com.uom.lims.refrange;

import com.uom.lims.api.common.enums.Gender;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Resolves the applicable reference interval for a parameter given the patient's
 * sex and age. Returns null when no banded range is configured — callers then
 * fall back to the parameter's own ref_low/ref_high/critical limits.
 */
@Service
@RequiredArgsConstructor
public class ReferenceRangeService {

    private final ReferenceRangeRepository repository;

    @Transactional(readOnly = true)
    public ReferenceRangeEntity resolve(UUID parameterId, Gender gender, Integer ageYears) {
        String sex = gender == null ? null : switch (gender) {
            case MALE -> "M";
            case FEMALE -> "F";
            default -> null;
        };
        return ReferenceRangeMatcher.match(repository.findByParameterId(parameterId), sex, ageYears);
    }
}
