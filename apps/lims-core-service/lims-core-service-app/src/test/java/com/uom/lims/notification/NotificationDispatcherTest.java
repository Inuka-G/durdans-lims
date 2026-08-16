package com.uom.lims.notification;

import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class NotificationDispatcherTest {

    @Test
    void otpSmsIdentifiesDurdansLimsAndExpiry() {
        EmailService emailService = mock(EmailService.class);
        SmsService smsService = mock(SmsService.class);
        NotificationDispatcher dispatcher = new NotificationDispatcher(emailService, smsService);

        dispatcher.onPhoneOtpRequested(new PhoneOtpRequestedEvent("+94702011540", "482913"));

        verify(smsService).sendSms("+94702011540",
                "Durdans LIMS verification code: 482913. Valid for 5 minutes. "
                        + "Do not share this code with anyone.");
    }

    @Test
    void sendsLifecycleMessageWithoutChangingItsTrackingContent() {
        EmailService emailService = mock(EmailService.class);
        SmsService smsService = mock(SmsService.class);
        NotificationDispatcher dispatcher = new NotificationDispatcher(emailService, smsService);
        PatientLifecycleSmsRequestedEvent event = new PatientLifecycleSmsRequestedEvent(
                "+94702011540", "Durdans LIMS | Payment confirmed | Order: ORD-001");

        dispatcher.onPatientLifecycleSmsRequested(event);

        verify(smsService).sendSms(event.phone(), event.message());
    }
}
