package com.uom.lims.api.catalog.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * A catalogue test rendered in one language, with everything a patient-facing channel
 * needs to answer for it: what it is called, what it costs, how long it takes and what
 * the patient has to do beforehand.
 *
 * <p>{@code englishName} is always populated alongside {@code testName}. Sri Lankan
 * patients read the English abbreviation off the report and the requisition slip, so a
 * Sinhala-only answer is harder to act on, not easier — callers render both.
 *
 * <p>{@code translated} says whether {@code testName} is a signed-off translation or an
 * English fallback. Callers use it to decide whether to apologise for the language, and
 * the admin console uses it to find the gaps.
 */
public record LocalizedTestResponse(
        UUID id,
        String testCode,
        String testName,
        String englishName,
        String colloquialName,
        String category,
        BigDecimal price,
        String sampleType,
        Integer turnAroundTimeHours,
        boolean fastingRequired,
        Integer fastingHours,
        boolean waterAllowed,
        boolean specialPrepRequired,
        String prepInstruction,
        String locale,
        boolean translated) {
}
