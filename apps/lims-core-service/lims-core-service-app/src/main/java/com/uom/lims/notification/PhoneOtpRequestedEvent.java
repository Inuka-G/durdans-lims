package com.uom.lims.notification;

/** Raised inside the patient transaction; the SMS is sent after commit. */
public record PhoneOtpRequestedEvent(String phone, String rawOtp) {
}
