package com.uom.lims.whatsapp.agent;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.time.Instant;

/**
 * Client-credentials token for the {@code lims-agent} service account, cached until
 * shortly before expiry. The 30-second margin is deliberately larger than any plausible
 * clock skew between two containers on the same host: a token that dies mid-request
 * turns into a confusing 401 deep inside a tool call.
 */
@Slf4j
@Component
public class KeycloakTokenClient {

    private static final long EXPIRY_MARGIN_SECONDS = 30;

    private final AgentProperties properties;
    private final RestClient restClient;

    private volatile CachedToken cached;

    public KeycloakTokenClient(AgentProperties properties,
                               @Qualifier("agentRestClient") RestClient restClient) {
        this.properties = properties;
        this.restClient = restClient;
    }

    public String accessToken() {
        CachedToken current = cached;
        if (current != null && Instant.now().isBefore(current.refreshAfter())) {
            return current.token();
        }
        return fetch();
    }

    private synchronized String fetch() {
        // Re-check under the lock: another thread may have refreshed while we waited.
        CachedToken current = cached;
        if (current != null && Instant.now().isBefore(current.refreshAfter())) {
            return current.token();
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());

        TokenResponse response = restClient.post()
                .uri(properties.tokenUrl())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(TokenResponse.class);

        if (response == null || response.accessToken() == null) {
            throw new IllegalStateException("Keycloak returned no access token for the agent service account");
        }
        long lifetime = Math.max(response.expiresIn() - EXPIRY_MARGIN_SECONDS, 5);
        cached = new CachedToken(response.accessToken(), Instant.now().plusSeconds(lifetime));
        log.debug("Refreshed agent service-account token; next refresh in {}s", lifetime);
        return response.accessToken();
    }

    private record CachedToken(String token, Instant refreshAfter) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("expires_in") long expiresIn) {
    }
}
