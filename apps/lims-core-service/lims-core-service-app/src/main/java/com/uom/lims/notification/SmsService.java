package com.uom.lims.notification;

public interface SmsService {
    void sendSms(String phoneNumber, String message);
}
