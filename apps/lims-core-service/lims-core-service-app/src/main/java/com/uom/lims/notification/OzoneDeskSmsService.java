package com.uom.lims.notification;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
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

    @Override
    public void sendSms(String phoneNumber, String message) {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("SMS message must not be blank");
        }

        URI uri = UriComponentsBuilder.fromUriString(properties.getEndpoint())
                .queryParam("user_id", properties.getUserId())
                .queryParam("api_key", properties.getApiKey())
                .queryParam("sender_id", properties.getSenderId())
                .queryParam("to", normalizeSriLankanPhone(phoneNumber))
                .queryParam("message", message)
                .build()
                .encode()
                .toUri();

        try {
            ResponseEntity<String> response = restTemplate.getForEntity(uri, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || isExplicitFailure(response.getBody())) {
                throw new SmsDeliveryException("SMS gateway rejected the request");
            }
        } catch (RestClientException ex) {
            // Never include the request URI here: it contains the API key and message body.
            throw new SmsDeliveryException("SMS gateway request failed", ex);
        }
    }

    static String normalizeSriLankanPhone(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            throw new IllegalArgumentException("SMS phone number must not be blank");
        }
        String digits = phoneNumber.replaceAll("\\D", "");
        if (digits.matches("07[01245678]\\d{7}")) {
            return "94" + digits.substring(1);
        }
        if (digits.matches("947[01245678]\\d{7}")) {
            return digits;
        }
        throw new IllegalArgumentException("SMS phone number must be a valid Sri Lankan mobile number");
    }

    private static boolean isExplicitFailure(String body) {
        if (body == null || body.isBlank()) {
            return false;
        }
        String normalized = body.toLowerCase(Locale.ROOT);
        return normalized.contains("error")
                || normalized.contains("failed")
                || normalized.contains("invalid")
                || normalized.contains("unauthorized")
                || normalized.contains("\"success\":false")
                || normalized.contains("\"status\":false");
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
