package com.uom.lims.notification;

import com.uom.lims.dispatch.LabReportData;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * F2: SMTP sends are wrapped in a retry + circuit-breaker ("smtp"). The SMTP socket
 * timeouts (application.yml) bound each attempt; the breaker fails fast during an
 * outage. Fallbacks rethrow a consistent RuntimeException — every caller already
 * tolerates that (logs / records a FAILED attempt / returns false).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.verification.base-url}")
    private String baseUrl;

    @Retry(name = "smtp", fallbackMethod = "sendVerificationEmailFallback")
    @CircuitBreaker(name = "smtp")
    public void sendVerificationEmail(String toEmail, String patientName, String rawToken) {

        String verificationLink = baseUrl + "/api/v1/patients/verify-email?token=" + rawToken;

        try {
            jakarta.mail.internet.MimeMessage message = mailSender.createMimeMessage();
            org.springframework.mail.javamail.MimeMessageHelper helper = new org.springframework.mail.javamail.MimeMessageHelper(
                    message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("Verify Your Email - LIMS");

            String htmlContent = generateVerificationEmailHtml(patientName, verificationLink);
            helper.setText(htmlContent, true);

            mailSender.send(message);
        } catch (jakarta.mail.MessagingException e) {
            throw new RuntimeException("Failed to send verification email to " + toEmail, e);
        }
    }

    @Retry(name = "smtp", fallbackMethod = "sendLabReportEmailFallback")
    @CircuitBreaker(name = "smtp")
    public void sendLabReportEmail(String toEmail, LabReportData report, byte[] reportPdf) {
        try {
            jakarta.mail.internet.MimeMessage message = mailSender.createMimeMessage();
            org.springframework.mail.javamail.MimeMessageHelper helper = new org.springframework.mail.javamail.MimeMessageHelper(
                    message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("Durdans Laboratory Report - " + display(report.testPanel())
                    + " - " + display(report.patientName()));
            helper.setText(generateLabReportEmailHtml(report), true);
            helper.addAttachment(reportFilename(report), new ByteArrayResource(reportPdf), "application/pdf");
            mailSender.send(message);
        } catch (jakarta.mail.MessagingException e) {
            throw new RuntimeException("Failed to send lab report email to " + toEmail, e);
        }
    }

    /**
     * Sends a plain notification email (used by the critical-value callback, H1). Kept
     * generic so the caller controls subject/body; throws so the caller can record a
     * failed attempt and retry/escalate.
     */
    @Retry(name = "smtp", fallbackMethod = "sendNotificationEmailFallback")
    @CircuitBreaker(name = "smtp")
    public void sendNotificationEmail(String toEmail, String subject, String bodyHtml) {
        try {
            jakarta.mail.internet.MimeMessage message = mailSender.createMimeMessage();
            org.springframework.mail.javamail.MimeMessageHelper helper =
                    new org.springframework.mail.javamail.MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(bodyHtml, true);
            mailSender.send(message);
        } catch (jakarta.mail.MessagingException e) {
            throw new RuntimeException("Failed to send notification email to " + toEmail, e);
        }
    }

    private String generateVerificationEmailHtml(String patientName, String verificationLink) {
        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: 'Inter', sans-serif; background-color: #f6f7f8; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                        .header { background-color: #101922; padding: 24px; text-align: center; }
                        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
                        .header span { color: #137fec; }
                        .content { padding: 40px 32px; color: #1e293b; }
                        .greeting { font-size: 18px; font-weight: 600; margin-bottom: 24px; }
                        .message { font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 32px; }
                        .button-container { text-align: center; margin: 32px 0; }
                        .button { background-color: #137fec; color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px; }
                        .footer { background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
                        .link-text { font-size: 12px; color: #94a3b8; margin-top: 24px; word-break: break-all; }
                        a.raw-link { color: #137fec; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div style="padding: 40px 0;">
                        <div class="container">
                            <div class="header">
                                <h1>DURDANS <span>ERP</span></h1>
                            </div>
                            <div class="content">
                                <div class="greeting">Dear %s,</div>
                                <div class="message">
                                    Thank you for registering with Durdans Hospital Patient Management System.
                                    To ensure the security of your account and access all features, please verify your email address.
                                </div>
                                <div class="button-container">
                                    <a href="%s" class="button" style="color: #ffffff !important;">Verify Email Address</a>
                                </div>
                                <div class="message">
                                    This link will expire in 24 hours. If you did not create an account, no further action is required.
                                </div>
                                <div class="link-text">
                                    If the button above doesn't work, copy and paste this link into your browser:<br>
                                    <a href="%s" class="raw-link">%s</a>
                                </div>
                            </div>
                            <div class="footer">
                                &copy; %d Durdans Hospital. All Rights Reserved.<br>
                                This is an automated message, please do not reply.
                            </div>
                        </div>
                    </div>
                </body>
                </html>
                """
                .formatted(patientName, verificationLink, verificationLink, verificationLink,
                        java.time.Year.now().getValue());
    }

    // ---- F2 fallbacks: surface a consistent failure when retries are exhausted or the
    //      breaker is open. Callers already handle a thrown RuntimeException. ----

    @SuppressWarnings("unused")
    private void sendVerificationEmailFallback(String toEmail, String patientName, String rawToken, Throwable t) {
        throw emailUnavailable(toEmail, t);
    }

    @SuppressWarnings("unused")
    private void sendLabReportEmailFallback(String toEmail, LabReportData report, byte[] reportPdf, Throwable t) {
        throw emailUnavailable(toEmail, t);
    }

    @SuppressWarnings("unused")
    private void sendNotificationEmailFallback(String toEmail, String subject, String bodyHtml, Throwable t) {
        throw emailUnavailable(toEmail, t);
    }

    private RuntimeException emailUnavailable(String toEmail, Throwable t) {
        log.warn("Email delivery to {} unavailable (retry/breaker): {}", toEmail, t.toString());
        return new RuntimeException("Email delivery unavailable (circuit open or retries exhausted)", t);
    }

    private String generateLabReportEmailHtml(LabReportData report) {
        StringBuilder rows = new StringBuilder();
        for (LabReportData.ResultRow row : report.results()) {
            String background = row.abnormal() ? "#fff1f2" : "#ffffff";
            String flagColor = row.abnormal() ? "#b42318" : "#18794e";
            rows.append("""
                    <tr style="background:%s">
                      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">%s</td>
                      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#0b1f3a">%s</td>
                      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">%s</td>
                      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">%s</td>
                      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:%s">%s</td>
                    </tr>
                    """.formatted(
                    background, html(row.parameter()), html(row.value()), html(row.unit()),
                    html(row.referenceRange()), flagColor, html(label(row.flag()))));
        }
        if (rows.isEmpty()) {
            rows.append("<tr><td colspan=\"5\" style=\"padding:16px;color:#64748b\">"
                    + "The detailed result is included in the attached PDF.</td></tr>");
        }

        String clinicalNote = report.clinicalNote() == null || report.clinicalNote().isBlank()
                ? ""
                : "<div style=\"margin-top:20px;padding:14px 16px;background:#f8fafc;border-left:4px solid #137fec\">"
                + "<strong>Clinical note</strong><br>" + html(report.clinicalNote()) + "</div>";

        return """
                <!doctype html>
                <html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#334155">
                  <div style="padding:28px 12px">
                    <div style="max-width:760px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(15,23,42,.08)">
                      <div style="background:#0b1f3a;padding:24px 30px;color:#fff">
                        <div style="font-size:22px;font-weight:800;letter-spacing:.5px">DURDANS HOSPITAL</div>
                        <div style="color:#7dd3fc;margin-top:4px">Laboratory Services</div>
                      </div>
                      <div style="padding:28px 30px">
                        <div style="display:inline-block;padding:6px 10px;border-radius:20px;background:#e8f5ee;color:#18794e;font-size:12px;font-weight:700">CLINICALLY AUTHORIZED</div>
                        <h1 style="margin:16px 0 8px;color:#0b1f3a;font-size:23px">Your laboratory report is ready</h1>
                        <p style="font-size:15px;line-height:1.6">Dear %s,</p>
                        <p style="font-size:15px;line-height:1.6">Your <strong>%s</strong> report has been clinically reviewed and authorized. A complete PDF report is attached to this email.</p>

                        <table role="presentation" style="width:100%%;margin:20px 0;border-collapse:collapse;background:#f8fafc;border-radius:8px">
                          <tr><td style="padding:10px 12px;color:#64748b">Patient ID</td><td style="padding:10px 12px;font-weight:700">%s</td><td style="padding:10px 12px;color:#64748b">Sample</td><td style="padding:10px 12px;font-weight:700">%s</td></tr>
                          <tr><td style="padding:10px 12px;color:#64748b">Report ID</td><td style="padding:10px 12px;font-weight:700">%s</td><td style="padding:10px 12px;color:#64748b">Authorized</td><td style="padding:10px 12px;font-weight:700">%s</td></tr>
                        </table>

                        <h2 style="font-size:16px;color:#0b1f3a;margin:22px 0 10px">Result summary</h2>
                        <div style="overflow-x:auto"><table style="width:100%%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb">
                          <thead><tr style="background:#0b1f3a;color:#fff;text-align:left">
                            <th style="padding:10px 12px">Parameter</th><th style="padding:10px 12px">Result</th><th style="padding:10px 12px">Unit</th><th style="padding:10px 12px">Reference</th><th style="padding:10px 12px">Flag</th>
                          </tr></thead><tbody>%s</tbody>
                        </table></div>
                        %s
                        <div style="margin-top:22px;padding:14px 16px;background:#eff6ff;border-radius:8px;color:#1e3a5f;font-size:13px;line-height:1.5">
                          <strong>Attached:</strong> Complete authorized laboratory report (PDF). Please consult your doctor for clinical interpretation.
                        </div>
                        <p style="margin-top:24px;font-size:13px;color:#64748b">Electronically authorized by <strong>%s</strong>.</p>
                      </div>
                      <div style="padding:18px 30px;background:#f8fafc;color:#94a3b8;font-size:11px;line-height:1.5">This confidential email contains personal health information intended only for the named recipient. Please do not reply to this automated message.</div>
                    </div>
                  </div>
                </body></html>
                """.formatted(
                html(report.patientName()), html(report.testPanel()), html(report.patientCode()),
                html(report.sampleBarcode()), html(report.reportReference()), format(report.authorizedAt()),
                rows, clinicalNote, html(report.authorizedBy()));
    }

    private static String reportFilename(LabReportData report) {
        String reference = display(report.reportReference()).replaceAll("[^A-Za-z0-9_-]", "-");
        return "Durdans-Lab-Report-" + reference + ".pdf";
    }

    private static String html(String value) {
        return HtmlUtils.htmlEscape(display(value));
    }

    private static String label(String value) {
        return display(value).replace('_', ' ');
    }

    private static String display(String value) {
        return value == null || value.isBlank() ? "Not recorded" : value.trim();
    }

    private static String format(java.time.OffsetDateTime value) {
        return value == null ? "Not recorded"
                : value.format(DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a", Locale.UK));
    }
}
