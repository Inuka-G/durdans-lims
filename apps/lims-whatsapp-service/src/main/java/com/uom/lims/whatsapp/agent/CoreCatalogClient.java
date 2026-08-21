package com.uom.lims.whatsapp.agent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
     * Coarse order progress. {@code requesterPhone} is the WhatsApp sender's number,
     * injected by the orchestrator from the conversation — the model cannot supply it,
     * which is the whole possession check.
     */
    public String getOrderStatus(String orderNo, String requesterPhone) {
        return get(UriComponentsBuilder.fromUriString(properties.coreBaseUrl())
                .path("/api/v1/agent/orders/status")
                .queryParam("orderNo", orderNo == null ? "" : orderNo)
                .queryParam("phone", requesterPhone == null ? "" : requesterPhone)
                .toUriString());
    }

    /**
     * @return the {@code data} node of the core's ApiResponse envelope, as compact JSON.
     * Failures come back as a JSON error object instead of an exception: the model can
     * say "I could not look that up" gracefully, which beats the whole reply dying.
     */
    /**
     * The identity step-up: possession (the WhatsApp number, injected server-side by the
     * caller of this method) plus the name and identity number the patient stated. A POST
     * because an identity number has no business in a URL or an access log.
     */
    public String verifyPatient(String identityNumber, String fullName, String requesterPhone) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("phone", requesterPhone == null ? "" : requesterPhone);
        body.put("identityNumber", identityNumber == null ? "" : identityNumber);
        body.put("fullName", fullName == null ? "" : fullName);
        return post(properties.coreBaseUrl() + "/api/v1/agent/patients/verify", body.toString());
    }

    private String post(String uri, String json) {
        try {
            String body = restClient.post()
                    .uri(uri)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenClient.accessToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json)
                    .retrieve()
                    .body(String.class);
            JsonNode root = objectMapper.readTree(body == null ? "{}" : body);
            JsonNode data = root.path("data");
            return data.isMissingNode() ? "{\"error\":\"empty response\"}" : data.toString();
        } catch (Exception e) {
            log.warn("Core lookup failed: {}", e.getMessage());
            return "{\"error\":\"lookup failed\"}";
        }
    }

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
