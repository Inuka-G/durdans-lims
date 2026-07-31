package com.uom.lims.service;

import com.uom.lims.api.patient.dto.response.PatientResponse;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Service
@RequiredArgsConstructor
public class PatientClientService {

    private final RestTemplate restTemplate;

    // WHY: Base URL is configurable so it works in both local and deployed environments
    @Value("${app.services.patient-base-url:http://localhost:11000}")
    private String patientBaseUrl;

    /**
     * WHY: Patient demographics are owned by the patient module — we fetch them
     * at response time rather than duplicating data across modules.
     *
     * <p>F2: wrapped in a retry + circuit-breaker. Exceptions now PROPAGATE (the old
     * internal catch is gone) so the resilience proxy can observe failures and trip the
     * breaker; the graceful-degradation contract (return null on failure) is preserved
     * by {@link #getPatientByCodeFallback}. RestTemplate already enforces 2s/5s timeouts.
     */
    @CircuitBreaker(name = "patientHttp")
    @Retry(name = "patientHttp", fallbackMethod = "getPatientByCodeFallback")
    public PatientResponse getPatientByCode(String patientCode, String bearerToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", bearerToken);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<PatientResponse> response = restTemplate.exchange(
            patientBaseUrl + "/api/v1/patients/" + patientCode,
            HttpMethod.GET,
            entity,
            PatientResponse.class
        );
        return response.getBody();
    }

    /** Graceful degradation: a patient-service outage returns null so order/bill responses still render. */
    @SuppressWarnings("unused")
    private PatientResponse getPatientByCodeFallback(String patientCode, String bearerToken, Throwable t) {
        log.warn("Patient lookup for {} degraded (retry/breaker): {}", patientCode, t.toString());
        return null;
    }
}
