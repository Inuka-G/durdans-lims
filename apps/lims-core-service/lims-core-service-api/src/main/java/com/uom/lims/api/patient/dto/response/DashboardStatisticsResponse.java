package com.uom.lims.api.patient.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(name = "DashboardStatisticsResponse", description = "Response containing patient-related dashboard statistics")
public class DashboardStatisticsResponse {

    @Schema(description = "Count of patients registered today", example = "42")
    private long patientsRegisteredToday;

    @Schema(description = "Count of new patients registered this week", example = "287")
    private long newPatientsThisWeek;

    @Schema(description = "Count of patients with pending verifications", example = "8")
    private long pendingVerifications;

    @Schema(description = "Percentage change vs yesterday", example = "+12%")
    private String todayTrend;
}
