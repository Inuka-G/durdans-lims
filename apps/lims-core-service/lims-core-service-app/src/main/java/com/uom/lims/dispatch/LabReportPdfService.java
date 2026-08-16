package com.uom.lims.dispatch;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.HeaderFooter;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class LabReportPdfService {

    private static final Color NAVY = new Color(11, 31, 58);
    private static final Color BLUE = new Color(19, 127, 236);
    private static final Color LIGHT_BLUE = new Color(235, 245, 255);
    private static final Color LIGHT_GREY = new Color(245, 247, 250);
    private static final Color BORDER = new Color(215, 222, 230);
    private static final Color ABNORMAL = new Color(255, 241, 242);
    private static final DateTimeFormatter DATE_TIME =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a", Locale.UK);

    public byte[] generate(LabReportData report) {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 42, 42, 46, 48);
            PdfWriter.getInstance(document, output);
            document.addTitle("Durdans Laboratory Report - " + safe(report.reportReference()));
            document.addAuthor("Durdans Hospital Laboratory");
            document.addSubject(safe(report.testPanel()));
            document.setFooter(new HeaderFooter(
                    new Phrase("Durdans Hospital Laboratory  |  Confidential patient report  |  Page ", font(8, Color.DARK_GRAY)),
                    true));
            document.open();

            addHeader(document, report);
            addPatientSection(document, report);
            addResults(document, report);
            addAuthorization(document, report);
            document.close();
            return output.toByteArray();
        } catch (DocumentException | java.io.IOException ex) {
            throw new IllegalStateException("Could not generate laboratory report PDF", ex);
        }
    }

    private void addHeader(Document document, LabReportData report) throws DocumentException {
        PdfPTable header = new PdfPTable(new float[]{3.2f, 1.3f});
        header.setWidthPercentage(100);
        header.setSpacingAfter(16);

        PdfPCell brand = cell(null, Color.WHITE, 0, 12);
        Paragraph hospital = new Paragraph("DURDANS HOSPITAL", bold(18, NAVY));
        hospital.setSpacingAfter(3);
        brand.addElement(hospital);
        brand.addElement(new Paragraph("Laboratory Services", bold(10, BLUE)));
        brand.addElement(new Paragraph("Authorized Laboratory Report", font(9, Color.DARK_GRAY)));
        header.addCell(brand);

        PdfPCell status = cell(null, LIGHT_BLUE, 0, 10);
        status.setHorizontalAlignment(Element.ALIGN_CENTER);
        Paragraph authorized = new Paragraph("CLINICALLY\nAUTHORIZED", bold(10, NAVY));
        authorized.setAlignment(Element.ALIGN_CENTER);
        status.addElement(authorized);
        header.addCell(status);
        document.add(header);

        PdfPTable meta = new PdfPTable(new float[]{1.1f, 2.1f, 1.1f, 2.1f});
        meta.setWidthPercentage(100);
        meta.setSpacingAfter(15);
        addPair(meta, "Report ID", safe(report.reportReference()));
        addPair(meta, "Test panel", safe(report.testPanel()));
        addPair(meta, "Sample", value(report.sampleBarcode()));
        addPair(meta, "Authorized", format(report.authorizedAt()));
        document.add(meta);
    }

    private void addPatientSection(Document document, LabReportData report) throws DocumentException {
        document.add(sectionTitle("PATIENT AND VISIT INFORMATION"));
        PdfPTable info = new PdfPTable(new float[]{1.1f, 2.1f, 1.1f, 2.1f});
        info.setWidthPercentage(100);
        info.setSpacingAfter(16);
        addPair(info, "Patient", value(report.patientName()));
        addPair(info, "Patient ID", value(report.patientCode()));
        addPair(info, "Date of birth", report.patientDob() == null ? "Not recorded" : report.patientDob().toString());
        addPair(info, "Gender", label(report.patientGender()));
        addPair(info, "Referring doctor", value(report.referringDoctor()));
        addPair(info, "Department", value(report.referringDepartment()));
        addPair(info, "Collected", format(report.collectedAt()));
        addPair(info, "Branch", value(report.branchCode()));
        document.add(info);
    }

    private void addResults(Document document, LabReportData report) throws DocumentException {
        document.add(sectionTitle("LABORATORY RESULTS"));
        PdfPTable table = new PdfPTable(new float[]{2.6f, 1.3f, 1.2f, 1.7f, 1.2f});
        table.setWidthPercentage(100);
        table.setHeaderRows(1);
        table.setSpacingAfter(14);
        for (String heading : new String[]{"Parameter", "Result", "Unit", "Reference range", "Flag"}) {
            PdfPCell header = cell(heading, NAVY, 1, 8);
            header.setPhrase(new Phrase(heading, bold(8, Color.WHITE)));
            table.addCell(header);
        }

        if (report.results().isEmpty()) {
            PdfPCell empty = cell("No result rows were available for this report.", LIGHT_GREY, 1, 9);
            empty.setColspan(5);
            empty.setPadding(12);
            table.addCell(empty);
        } else {
            for (LabReportData.ResultRow row : report.results()) {
                Color background = row.abnormal() ? ABNORMAL : Color.WHITE;
                table.addCell(resultCell(value(row.parameter()), background, false));
                table.addCell(resultCell(value(row.value()), background, true));
                table.addCell(resultCell(value(row.unit()), background, false));
                table.addCell(resultCell(value(row.referenceRange()), background, false));
                table.addCell(resultCell(label(row.flag()), background, row.abnormal()));
            }
        }
        document.add(table);
    }

    private void addAuthorization(Document document, LabReportData report) throws DocumentException {
        if (report.clinicalNote() != null && !report.clinicalNote().isBlank()) {
            document.add(sectionTitle("CLINICAL NOTE"));
            PdfPTable note = new PdfPTable(1);
            note.setWidthPercentage(100);
            note.setSpacingAfter(16);
            PdfPCell noteCell = cell(report.clinicalNote(), LIGHT_GREY, 1, 9);
            noteCell.setPadding(10);
            note.addCell(noteCell);
            document.add(note);
        }

        PdfPTable signature = new PdfPTable(new float[]{3f, 2f});
        signature.setWidthPercentage(100);
        signature.setSpacingBefore(8);
        PdfPCell notice = cell(null, Color.WHITE, 0, 8);
        notice.addElement(new Paragraph("Interpret results together with clinical findings and medical history.",
                font(8, Color.DARK_GRAY)));
        notice.addElement(new Paragraph("This electronically generated report is confidential.",
                font(8, Color.DARK_GRAY)));
        signature.addCell(notice);
        PdfPCell sign = cell(null, Color.WHITE, 0, 8);
        sign.addElement(new Paragraph("Electronically authorized by", font(8, Color.DARK_GRAY)));
        sign.addElement(new Paragraph(value(report.authorizedBy()), bold(10, NAVY)));
        sign.addElement(new Paragraph(format(report.authorizedAt()), font(8, Color.DARK_GRAY)));
        signature.addCell(sign);
        document.add(signature);
    }

    private static Paragraph sectionTitle(String text) {
        Paragraph title = new Paragraph(text, bold(9, NAVY));
        title.setSpacingBefore(2);
        title.setSpacingAfter(7);
        return title;
    }

    private static void addPair(PdfPTable table, String label, String value) {
        table.addCell(cell(label, LIGHT_GREY, 1, 8));
        PdfPCell data = cell(value, Color.WHITE, 1, 8);
        data.setPhrase(new Phrase(value, bold(8, NAVY)));
        table.addCell(data);
    }

    private static PdfPCell resultCell(String text, Color background, boolean bold) {
        PdfPCell cell = cell(text, background, 1, 8);
        cell.setPhrase(new Phrase(text, bold ? bold(8, NAVY) : font(8, Color.DARK_GRAY)));
        return cell;
    }

    private static PdfPCell cell(String text, Color background, int border, int size) {
        PdfPCell cell = new PdfPCell(text == null ? null : new Phrase(text, font(size, Color.DARK_GRAY)));
        cell.setBackgroundColor(background);
        cell.setBorder(border == 0 ? Rectangle.NO_BORDER : Rectangle.BOX);
        cell.setBorderColor(BORDER);
        cell.setBorderWidth(0.5f);
        cell.setPadding(7);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        return cell;
    }

    private static Font font(float size, Color color) {
        return FontFactory.getFont(FontFactory.HELVETICA, size, Font.NORMAL, color);
    }

    private static Font bold(float size, Color color) {
        return FontFactory.getFont(FontFactory.HELVETICA_BOLD, size, Font.BOLD, color);
    }

    private static String format(java.time.temporal.TemporalAccessor value) {
        return value == null ? "Not recorded" : DATE_TIME.format(value);
    }

    private static String value(String value) {
        return value == null || value.isBlank() ? "Not recorded" : value.trim();
    }

    private static String safe(String value) {
        return value(value);
    }

    private static String label(String value) {
        return value(value).replace('_', ' ');
    }
}
