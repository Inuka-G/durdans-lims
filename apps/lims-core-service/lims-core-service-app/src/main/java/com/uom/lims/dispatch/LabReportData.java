package com.uom.lims.dispatch;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/** Immutable, channel-neutral representation of an authorized laboratory report. */
public record LabReportData(
        String reportReference,
        String branchCode,
        String patientCode,
        String patientName,
        LocalDate patientDob,
        String patientGender,
        String referringDoctor,
        String referringDepartment,
        String testPanel,
        String sampleBarcode,
        OffsetDateTime collectedAt,
        OffsetDateTime authorizedAt,
        String authorizedBy,
        String clinicalNote,
        List<ResultRow> results
) {
    public LabReportData {
        results = results == null ? List.of() : List.copyOf(results);
    }

    public record ResultRow(
            String parameter,
            String value,
            String unit,
            String referenceRange,
            String flag
    ) {
        public boolean abnormal() {
            return flag != null && !flag.isBlank() && !"NORMAL".equalsIgnoreCase(flag);
        }
    }
}
