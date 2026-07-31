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
        try {
            smsService.sendSms(event.phone(), "Your verification OTP is: " + event.rawOtp());
        } catch (Exception e) {
            log.error("Failed to send OTP SMS to {}", PiiMasker.maskPhone(event.phone()), e);
        }
    }
}
