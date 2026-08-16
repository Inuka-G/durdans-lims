package com.uom.lims.notification;

/** Raised in a business transaction and delivered asynchronously after commit. */
public record PatientLifecycleSmsRequestedEvent(String phone, String message) {
}
