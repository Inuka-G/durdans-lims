package com.uom.lims.notification;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Locale;

/** Sends both patient OTPs and report notifications through OzoneDesk. */
@Service
@ConditionalOnProperty(name = "app.sms.provider", havingValue = "ozonedesk")
public class OzoneDeskSmsService implements SmsService {

    private final SmsProperties properties;
    private final RestTemplate restTemplate;

    public OzoneDeskSmsService(
            SmsProperties properties,
            @Qualifier("smsRestTemplate") RestTemplate restTemplate) {
        this.properties = properties;
        this.restTemplate = restTemplate;
    }

    @PostConstruct
    void validateConfiguration() {
        requireConfigured("SMS_API_URL", properties.getEndpoint());
        requireConfigured("SMS_USER_ID", properties.getUserId());
        requireConfigured("SMS_API_KEY", properties.getApiKey());
        requireConfigured("SMS_SENDER_ID", properties.getSenderId());
    }

    /**
     * Posted as a form body rather than hung off the query string. Two reasons, and the
     * first is why a multi-line report SMS used to arrive as its heading alone: over a
     * GET a newline survives only as %0A, the gateway cut the message there, and
     * everything below the first line was dropped. A form body carries the line breaks
     * through intact. The second is that the API key no longer travels inside a URL,
     * where every proxy and access log along the path would keep a copy of it.
     */
    @Override
    public void sendSms(String phoneNumber, String message) {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("SMS message must not be blank");
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("user_id", properties.getUserId());
        form.add("api_key", properties.getApiKey());
        form.add("sender_id", properties.getSenderId());
        form.add("to", normalizeSriLankanPhone(phoneNumber));
        form.add("message", flattenLines(GsmText.sanitize(message)));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(
                    properties.getEndpoint(), new HttpEntity<>(form, headers), String.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new SmsDeliveryException("SMS gateway returned HTTP "
                        + response.getStatusCode().value() + " (" + summarize(response.getBody()) + ")");
            }
            if (isExplicitFailure(response.getBody())) {
                // Carry the gateway's own words into the log. Without them a rejected OTP
                // was indistinguishable from a delivered one that simply never showed up.
                throw new SmsDeliveryException(
                        "SMS gateway rejected the request: " + summarize(response.getBody()));
            }
        } catch (RestClientException ex) {
            // Never include the request here: the form body carries the API key and the message.
            throw new SmsDeliveryException("SMS gateway request failed", ex);
        }
    }

    /**
     * OzoneDesk drops everything after the first line break, even when the message
     * travels correctly %0A-encoded in a form body — a dispatched report SMS arrived
     * as "Durdans Hospital Laboratory" alone. Until the gateway handles multi-line
     * text, every line break becomes a " | " separator here, at the adapter, so the
     * templates (and the mock provider that echoes them in dev) keep their layout.
     */
    static String flattenLines(String message) {
        return message.replaceAll("\\s*\\n+\\s*", " | ").trim();
    }

    /**
     * Sri Lankan mobile numbers reach this from free-text entry, so every shape the
     * front desk actually types has to resolve to the gateway's 94XXXXXXXXX. The old
     * version accepted only "07XXXXXXXX" and "947XXXXXXXX" and threw on anything else
     * — and because the OTP dispatcher swallows exceptions, a patient stored as
     * "+94 077 123 4567" never received a code and nothing said why.
     */
    static String normalizeSriLankanPhone(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            throw new IllegalArgumentException("SMS phone number must not be blank");
        }

        String digits = phoneNumber.replaceAll("\\D", "");

        // 0094... - the international prefix dialled the old way.
        if (digits.startsWith("00")) {
            digits = digits.substring(2);
        }
        // 94 0 77... - country code with the national trunk '0' left in front of it.
        if (digits.length() == 12 && digits.startsWith("940")) {
            digits = "94" + digits.substring(3);
        }
        // 077... - the plain local form.
        if (digits.length() == 10 && digits.startsWith("0")) {
            digits = "94" + digits.substring(1);
        }
        // 77... - local form with the trunk '0' omitted.
        if (digits.length() == 9 && digits.startsWith("7")) {
            digits = "94" + digits;
        }

        // Structural check only: 94 + a 7X mobile prefix + 7 digits. Deliberately not a
        // whitelist of allocated prefixes - that list changes, and a number wrongly
        // rejected here is a patient who silently receives nothing.
        if (!digits.matches("947\\d{8}")) {
            throw new IllegalArgumentException("SMS phone number must be a valid Sri Lankan mobile number");
        }
        return digits;
    }

    /**
     * Only an explicit negative counts. The previous version flagged any body containing
     * "error", which also matches the {@code "error":null} and {@code errorCode=0} that
     * gateways put in successful responses - turning a delivered message into a logged
     * failure, and hiding the real ones in the noise.
     */
    private static boolean isExplicitFailure(String body) {
        if (body == null || body.isBlank()) {
            return false;
        }
        String normalized = body.toLowerCase(Locale.ROOT).replaceAll("\\s+", "");

        if (normalized.contains("\"success\":false")
                || normalized.contains("\"status\":false")
                || normalized.contains("\"status\":\"failed\"")
                || normalized.contains("unauthorized")
                || normalized.contains("invalid")
                || normalized.contains("failed")) {
            return true;
        }

        // "error" on its own is only a failure when it is not an empty or zero field.
        boolean neutralErrorField = normalized.contains("\"error\":null")
                || normalized.contains("\"error\":\"\"")
                || normalized.contains("\"error\":0")
                || normalized.contains("\"errorcode\":0")
                || normalized.contains("errorcode=0")
                || normalized.contains("error=0");
        return normalized.contains("error") && !neutralErrorField;
    }

    /** A short, quotable slice of the gateway's reply for logs - never the request. */
    private static String summarize(String body) {
        if (body == null || body.isBlank()) {
            return "empty response";
        }
        String flat = body.replaceAll("\\s+", " ").trim();
        return flat.length() <= 200 ? flat : flat.substring(0, 197) + "...";
    }

    private static void requireConfigured(String envName, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(envName + " must be set when SMS_PROVIDER=ozonedesk");
        }
    }

    static class SmsDeliveryException extends RuntimeException {
        SmsDeliveryException(String message) {
            super(message);
        }

        SmsDeliveryException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
