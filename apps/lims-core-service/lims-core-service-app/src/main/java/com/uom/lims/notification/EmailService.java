package com.uom.lims.notification;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

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
    public void sendLabReportEmail(String toEmail, String patientName, String reportReference, String testPanelLabel,
            String artifactUri) {
        try {
            jakarta.mail.internet.MimeMessage message = mailSender.createMimeMessage();
            org.springframework.mail.javamail.MimeMessageHelper helper = new org.springframework.mail.javamail.MimeMessageHelper(
                    message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("Your laboratory report " + reportReference + " – Durdans Hospital");
            String linkOrNote = (artifactUri != null && !artifactUri.isBlank())
                    ? "<p><a href=\"" + artifactUri + "\">Download report</a></p>"
                    : "<p>Your report is available at the laboratory reception.</p>";
            String html = """
                    <p>Dear %s,</p>
                    <p>Your authorized laboratory report is ready.</p>
                    <ul>
                    <li><b>Report</b>: %s</li>
                    <li><b>Test</b>: %s</li>
                    </ul>
                    %s
                    <p>— Durdans Hospital Laboratory</p>
                    """
                    .formatted(patientName, reportReference, testPanelLabel, linkOrNote);
            helper.setText(html, true);
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
    private void sendLabReportEmailFallback(String toEmail, String patientName, String reportReference,
            String testPanelLabel, String artifactUri, Throwable t) {
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
}
