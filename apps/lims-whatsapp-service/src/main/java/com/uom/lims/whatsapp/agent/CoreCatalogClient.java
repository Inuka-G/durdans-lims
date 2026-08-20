package com.uom.lims.whatsapp.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * The agent's read-only reach into the clinical core: three catalogue endpoints under
 * {@code /api/v1/agent/**}, nothing else. Responses are passed to the model as the raw
 * {@code data} JSON rather than re-modelled DTOs — the model consumes JSON either way,
 * and a second copy of the DTO tree would only add a place for the two services to
 * disagree.
 */
@Slf4j
@Component
public class CoreCatalogClient {

    private final AgentProperties properties;
    private final KeycloakTokenClient tokenClient;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public CoreCatalogClient(AgentProperties properties,
                             KeycloakTokenClient tokenClient,
                             @Qualifier("agentRestClient") RestClient restClient,
                             ObjectMapper objectMapper) {
        this.properties = properties;
        this.tokenClient = tokenClient;
        this.restClient = restClient;
        this.objectMapper = objectMapper;
    }

    public String searchTests(String query, String locale) {
        return get(UriComponentsBuilder.fromUriString(properties.coreBaseUrl())
                .path("/api/v1/agent/catalog/tests")
                .queryParam("q", query == null ? "" : query)
                .queryParamIfPresent("locale", java.util.Optional.ofNullable(locale))
                .toUriString());
    }

    public String listPackages(String locale) {
        return get(UriComponentsBuilder.fromUriString(properties.coreBaseUrl())
                .path("/api/v1/agent/catalog/packages")
                .queryParamIfPresent("locale", java.util.Optional.ofNullable(locale))
                .toUriString());
    }

    public String getPackage(String packageCode, String locale) {
        return get(UriComponentsBuilder.fromUriString(properties.coreBaseUrl())
                .path("/api/v1/agent/catalog/packages/{code}")
                .queryParamIfPresent("locale", java.util.Optional.ofNullable(locale))
                .buildAndExpand(packageCode)
                .toUriString());
    }

    /**
     * @return the {@code data} node of the core's ApiResponse envelope, as compact JSON.
     * Failures come back as a JSON error object instead of an exception: the model can
     * say "I could not look that up" gracefully, which beats the whole reply dying.
     */
    private String get(String uri) {
        try {
            String body = restClient.get()
                    .uri(uri)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenClient.accessToken())
                    .retrieve()
                    .body(String.class);
            JsonNode root = objectMapper.readTree(body == null ? "{}" : body);
            JsonNode data = root.path("data");
            return data.isMissingNode() ? "{\"error\":\"empty response\"}" : data.toString();
        } catch (Exception e) {
            log.warn("Catalog lookup failed: {}", e.getMessage());
            return "{\"error\":\"catalogue lookup failed\"}";
        }
    }
}
