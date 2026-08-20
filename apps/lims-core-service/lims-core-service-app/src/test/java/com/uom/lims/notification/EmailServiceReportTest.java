package com.uom.lims.notification;

import com.uom.lims.dispatch.LabReportData;
import com.uom.lims.dispatch.LabReportPdfService;
import jakarta.mail.BodyPart;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailServiceReportTest {

    @Test
    void sendsProfessionalHtmlSummaryAndPdfAttachment() throws Exception {
        JavaMailSender sender = mock(JavaMailSender.class);
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        when(sender.createMimeMessage()).thenReturn(message);
        EmailService service = new EmailService(sender);
        ReflectionTestUtils.setField(service, "fromEmail", "laboratory@durdans.test");
        ReflectionTestUtils.setField(service, "baseUrl", "http://localhost:11000");

        LabReportData report = com.uom.lims.dispatch.LabReportPdfServiceTest.sampleReport();
        byte[] pdf = new LabReportPdfService().generate(report);
        service.sendLabReportEmail("patient@example.test", report, pdf);

        verify(sender).send(message);
        assertThat(message.getSubject()).isEqualTo(
                "Durdans Laboratory Report - Full Blood Count - Kalana Sandakelum");
        MimeMultipart multipart = (MimeMultipart) message.getContent();
        assertThat(multipart.getCount()).isGreaterThanOrEqualTo(2);

        boolean foundHtml = false;
        boolean foundPdf = false;
        for (int i = 0; i < multipart.getCount(); i++) {
            BodyPart part = multipart.getBodyPart(i);
            String disposition = part.getDisposition();
            foundHtml = foundHtml || containsText(part.getContent(), "Result summary");
            if (jakarta.mail.Part.ATTACHMENT.equalsIgnoreCase(disposition)) {
                foundPdf = part.getFileName().endsWith(".pdf")
                        && part.getInputStream().readAllBytes().length > 2_000;
            }
        }
        assertThat(foundHtml).isTrue();
        assertThat(foundPdf).isTrue();
    }

    private static boolean containsText(Object content, String expected) throws Exception {
        if (content instanceof String text) {
            return text.contains(expected);
        }
        if (content instanceof MimeMultipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                if (containsText(multipart.getBodyPart(i).getContent(), expected)) return true;
            }
        }
        return false;
    }
}
