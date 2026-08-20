package com.uom.lims.whatsapp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * The HTTP client for Graph API calls. Timeouts are not optional: replies run on a
 * small bounded executor, and a hung connection with no read timeout would pin one of
 * its threads for as long as the socket lives.
 */
@Configuration
public class MetaHttpConfig {

    @Bean
    public RestClient metaRestClient(RestClient.Builder builder) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(15_000);
        return builder.requestFactory(factory).build();
    }

    /**
     * Separate client for the agent's calls (Gemini, Keycloak, lims-core-service).
     * Gemini legitimately takes longer than a Graph send — a model turn over a long
     * context is tens of seconds — so it gets its own budget instead of inheriting
     * the send path's tight one.
     */
    @Bean
    public RestClient agentRestClient(RestClient.Builder builder) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(45_000);
        return builder.requestFactory(factory).build();
    }

    /**
     * Call-event forwarding to the voice gateway. Tight on purpose: this runs on the
     * webhook ack thread inside Meta's ~30-second call-accept window, and a gateway
     * that cannot take the handoff in five seconds is not going to answer the call.
     */
    @Bean
    public RestClient voiceRestClient(RestClient.Builder builder) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2_000);
        factory.setReadTimeout(5_000);
        return builder.requestFactory(factory).build();
    }
}
