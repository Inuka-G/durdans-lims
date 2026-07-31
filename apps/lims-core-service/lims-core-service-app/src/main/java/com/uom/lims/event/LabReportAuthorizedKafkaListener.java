package com.uom.lims.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.api.dispatch.dto.request.RegisterAuthorizedReportRequest;
import com.uom.lims.dispatch.DispatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.kafka.lab-report-listener-enabled", havingValue = "true")
public class LabReportAuthorizedKafkaListener {

    /** Audit source when registration is driven by Kafka (no HTTP client IP exists). */
    private static final String AUDIT_CLIENT_SOURCE = "kafka:lab.report.authorized";

    private final DispatchService dispatchService;
    private final ObjectMapper objectMapper;

    @KafkaListener(
            topics = "${app.kafka.topics.lab-report-authorized:lab.report.authorized}",
            groupId = "${spring.kafka.consumer.group-id:lims-dispatch-ingress}",
            containerFactory = "kafkaStringListenerContainerFactory")
    public void onLabReportAuthorized(String payload) {
        try {
            RegisterAuthorizedReportRequest request = objectMapper.readValue(payload, RegisterAuthorizedReportRequest.class);
            // Trusted ingress: no HTTP client. Use elevated context so branch rules match controller super-admin path;
            // broker ACLs and payload signing remain the real perimeter.
            var auth = new UsernamePasswordAuthenticationToken(
                    "kafka-lab-report-authorized",
                    "n/a",
                    List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")));
            SecurityContextHolder.getContext().setAuthentication(auth);
            dispatchService.registerAuthorizedReport(request, AUDIT_CLIENT_SOURCE);
        } catch (Exception e) {
            log.error("Failed to process lab.report.authorized message", e);
            throw new RuntimeException(e);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
