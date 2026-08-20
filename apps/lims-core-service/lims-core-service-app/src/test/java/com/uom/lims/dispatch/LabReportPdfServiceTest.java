package com.uom.lims.dispatch;

import com.lowagie.text.pdf.PdfReader;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

public class LabReportPdfServiceTest {

    @Test
    void generatesReadableAuthorizedReportAndPreviewArtifact() throws Exception {
        LabReportData report = sampleReport();
        byte[] pdf = new LabReportPdfService().generate(report);

        assertThat(pdf).startsWith("%PDF".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        try (PdfReader reader = new PdfReader(pdf)) {
            assertThat(reader.getNumberOfPages()).isEqualTo(1);
        }

        Path preview = Path.of("build", "generated-reports", "sample-lab-report.pdf");
        Files.createDirectories(preview.getParent());
        Files.write(preview, pdf);
        assertThat(Files.size(preview)).isGreaterThan(2_000);
    }

    public static LabReportData sampleReport() {
        return new LabReportData(
                "d87a4b51-3230-45a4-a0c9-0b9dcbbfa742",
                "BR001",
                "PAT-000184",
                "Kalana Sandakelum",
                LocalDate.of(1999, 6, 14),
                "MALE",
                "Dr. A. Perera",
                "Outpatient Department",
                "Full Blood Count",
                "SMP-20260816-0042",
                OffsetDateTime.of(2026, 8, 16, 13, 20, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                OffsetDateTime.of(2026, 8, 16, 14, 25, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                "Dr. N. Fernando, Consultant Pathologist",
                "Mild neutrophilia. Correlate with the patient's clinical findings.",
                List.of(
                        new LabReportData.ResultRow("White Blood Cell Count", "12.8", "10^9/L", "4.0 - 11.0", "HIGH"),
                        new LabReportData.ResultRow("Red Blood Cell Count", "5.1", "10^12/L", "4.5 - 5.9", "NORMAL"),
                        new LabReportData.ResultRow("Haemoglobin", "14.6", "g/dL", "13.5 - 17.5", "NORMAL"),
                        new LabReportData.ResultRow("Haematocrit", "44.2", "%", "41.0 - 53.0", "NORMAL"),
                        new LabReportData.ResultRow("Platelet Count", "245", "10^9/L", "150 - 400", "NORMAL")));
    }
}
