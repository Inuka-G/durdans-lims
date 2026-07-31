package com.uom.lims.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class RestTemplateConfig {
    // WHY: RestTemplate enriches order/bill responses with patient demographics.
    // Explicit connect/read timeouts are essential: without them a slow or hung
    // dependency blocks the calling thread (and the DB connection it holds)
    // indefinitely, cascading into pool exhaustion across order/bill/sample lists.
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .connectTimeout(Duration.ofSeconds(2))
                .readTimeout(Duration.ofSeconds(5))
                .build();
    }
}
