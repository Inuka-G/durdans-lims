package com.uom.lims.api.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * WHY: Summarizes collection throughput to monitor phlebotomist performance and bottleneck risks.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PhlebotomyStatsResponse {
    private long pendingCollections;
    private long urgentSamples;
    private long collectedToday;
    private long rejections;
}
