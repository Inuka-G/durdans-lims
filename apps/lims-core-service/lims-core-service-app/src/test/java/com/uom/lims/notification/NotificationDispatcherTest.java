package com.uom.lims.notification;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
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
                "Durdans LIMS\n"
                        + "\n"
                        + "Verification code: 482913\n"
                        + "\n"
                        + "Valid for 5 minutes.\n"
                        + "Do not share this code with anyone.");
    }

    @Test
    void anUnusablePhoneNumberDoesNotEscapeTheDispatcher() {
        // The originating transaction has already committed and the caller has its 200.
        // Throwing here would only kill the async worker, so the failure is logged and
        // swallowed - but it has to stay swallowed, hence this test.
        EmailService emailService = mock(EmailService.class);
        SmsService smsService = mock(SmsService.class);
        doThrow(new IllegalArgumentException("SMS phone number must be a valid Sri Lankan mobile number"))
                .when(smsService).sendSms(anyString(), anyString());
        NotificationDispatcher dispatcher = new NotificationDispatcher(emailService, smsService);

        assertThatCode(() -> dispatcher.onPhoneOtpRequested(
                new PhoneOtpRequestedEvent("0112345678", "482913")))
                .doesNotThrowAnyException();
    }

    @Test
    void aGatewayFailureDoesNotEscapeTheDispatcher() {
        EmailService emailService = mock(EmailService.class);
        SmsService smsService = mock(SmsService.class);
        doThrow(new RuntimeException("SMS gateway rejected the request: Invalid API key"))
                .when(smsService).sendSms(anyString(), anyString());
        NotificationDispatcher dispatcher = new NotificationDispatcher(emailService, smsService);

        assertThatCode(() -> dispatcher.onPatientLifecycleSmsRequested(
                new PatientLifecycleSmsRequestedEvent("+94702011540", "Durdans LIMS\nOrder received")))
                .doesNotThrowAnyException();
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
