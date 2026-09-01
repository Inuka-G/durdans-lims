package com.uom.lims.notification;

import com.uom.lims.util.PiiMasker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Sends patient notifications AFTER the originating transaction commits, on the
 * bounded notification executor. This keeps blocking SMTP/SMS I/O out of the DB
 * transaction: a slow or failing provider can no longer pin a connection or roll
 * back patient registration, and a rolled-back transaction never sends a message.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationDispatcher {

    private final EmailService emailService;
    private final SmsService smsService;

    @Async("notificationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onEmailVerificationRequested(EmailVerificationRequestedEvent event) {
        try {
            emailService.sendVerificationEmail(event.email(), event.fullName(), event.rawToken());
        } catch (Exception e) {
            log.error("Failed to send verification email to {}", PiiMasker.maskEmail(event.email()), e);
        }
    }

    @Async("notificationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPhoneOtpRequested(PhoneOtpRequestedEvent event) {
        String message = "Durdans LIMS\n"
                + "\n"
                + "Verification code: " + event.rawOtp() + "\n"
                + "\n"
                + "Valid for 5 minutes.\n"
                + "Do not share this code with anyone.";
        send("phone OTP", event.phone(), message);
    }

    @Async("notificationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPatientLifecycleSmsRequested(PatientLifecycleSmsRequestedEvent event) {
        send("patient lifecycle SMS", event.phone(), event.message());
    }

    /**
     * The send has to be swallowed - the transaction it followed has already committed,
     * and a failed SMS must not be retried into a second OTP or a duplicate bill alert.
     * What it must not do is vanish. The caller (an HTTP 200 and an "OTP sent" toast)
     * has no idea this failed, so the log is the only record there is, and it separates
     * the two causes that need different people to fix them: a number the gateway
     * cannot dial is the front desk's to correct, anything else is the gateway's.
     */
    private void send(String kind, String phone, String message) {
        String masked = PiiMasker.maskPhone(phone);
        try {
            smsService.sendSms(phone, message);
            log.debug("Sent {} to {} ({} chars)", kind, masked, message.length());
        } catch (IllegalArgumentException e) {
            log.error("Did not send {} to {}: unusable phone number on the patient record - {}",
                    kind, masked, e.getMessage());
        } catch (Exception e) {
            log.error("Failed to send {} to {}", kind, masked, e);
        }
    }
}
