package com.uom.lims.resilience;

import com.uom.lims.AbstractIntegrationTest;
import com.uom.lims.api.patient.dto.response.PatientResponse;
import com.uom.lims.service.PatientClientService;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.retry.RetryRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Proves F2: the outbound HTTP path retries on failure and then falls back to the
 * graceful-degradation contract (null), and the S3/SMTP/HTTP resilience instances are
 * wired from configuration. The fallback lives on {@code @Retry} (not
 * {@code @CircuitBreaker}) so the breaker re-throws and the retry actually re-attempts.
 */
class F2ResilienceIntegrationTest extends AbstractIntegrationTest {

    @MockitoBean
    private RestTemplate restTemplate;

    @Autowired
    private PatientClientService patientClientService;
    @Autowired
    private CircuitBreakerRegistry circuitBreakerRegistry;
    @Autowired
    private RetryRegistry retryRegistry;

    @Test
    void httpFailureRetriesThenFallsBackToNull() {
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(PatientResponse.class)))
                .thenThrow(new ResourceAccessException("connection refused"));

        PatientResponse result = patientClientService.getPatientByCode("P-1", "Bearer x");

        // Fallback preserves graceful degradation (callers tolerate null patient fields).
        assertThat(result).isNull();
        // patientHttp retry maxAttempts = 2 → exactly two attempts before the fallback.
        verify(restTemplate, times(2))
                .exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(PatientResponse.class));
    }

    @Test
    void resilienceInstancesAreRegisteredFromConfig() {
        assertThat(circuitBreakerRegistry.find("s3")).isPresent();
        assertThat(circuitBreakerRegistry.find("smtp")).isPresent();
        assertThat(circuitBreakerRegistry.find("patientHttp")).isPresent();
        assertThat(retryRegistry.retry("patientHttp").getRetryConfig().getMaxAttempts()).isEqualTo(2);
    }
}
