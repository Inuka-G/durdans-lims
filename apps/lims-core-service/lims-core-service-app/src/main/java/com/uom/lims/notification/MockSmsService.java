package com.uom.lims.notification;

import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class MockSmsService implements SmsService {

    @Override
    public void sendSms(String phoneNumber, String message) {
        // Do not log message bodies — they can contain OTPs/PII. Log length only.
        log.info("MOCK SMS to {} ({} chars)", maskPhone(phoneNumber), message == null ? 0 : message.length());
    }

    private static String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) {
            return "****";
        }
        return "****" + phone.substring(phone.length() - 4);
    }
}
