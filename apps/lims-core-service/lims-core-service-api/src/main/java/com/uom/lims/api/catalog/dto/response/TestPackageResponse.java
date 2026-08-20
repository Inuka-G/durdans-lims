package com.uom.lims.api.catalog.dto.response;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * A package rendered in one language.
 *
 * <p>{@code individualTotal} and {@code saving} are computed, never stored — the saving
 * is the whole reason a patient asks about a package, and it moves whenever any component
 * test is repriced.
 *
 * <p>{@code fastingRequired} and {@code fastingHours} are the strictest requirement across
 * the components, not the first one found. A bundle containing one twelve-hour fasting
 * test is a twelve-hour fasting appointment.
 */
public record TestPackageResponse(
        UUID id,
        String packageCode,
        String packageName,
        String englishName,
        String category,
        String description,
        BigDecimal price,
        BigDecimal individualTotal,
        BigDecimal saving,
        Integer turnAroundTimeHours,
        boolean fastingRequired,
        Integer fastingHours,
        boolean active,
        List<LocalizedTestResponse> items,
        String locale,
        boolean translated) {
}
