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
}
