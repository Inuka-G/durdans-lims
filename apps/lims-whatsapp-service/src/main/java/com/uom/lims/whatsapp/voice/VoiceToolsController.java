package com.uom.lims.whatsapp.voice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.uom.lims.whatsapp.agent.CoreCatalogClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/**
 * The tool layer's voice-facing surface: the same catalogue and order lookups the text
 * agent uses, returned as pre-rendered spoken sentences (see {@link VoiceSpokenFormatter}).
 *
 * <p>Reached only by the voice gateway over the host boundary, authenticated by a
 * shared token compared in constant time. Caddy still proxies this path from the
 * internet, which is why the token is checked here rather than trusted to the network —
 * a blank configured token rejects everything, so an undeployed voice stack leaves no
 * open door. The caller's WhatsApp id for the possession check arrives from the CALL
 * event via the gateway, never from model output.
 */
@Slf4j
@RestController
@RequestMapping("/internal/voice/tools")
@RequiredArgsConstructor
public class VoiceToolsController {

    private static final int MAX_SPOKEN_MATCHES = 3;

    private final VoiceProperties properties;
    private final CoreCatalogClient catalog;
    private final VoiceSpokenFormatter formatter;
    private final ObjectMapper mapper;

    @PostMapping("/search-tests")
    public ResponseEntity<Object> searchTests(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody JsonNode body) throws Exception {
        if (!authorized(token)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        JsonNode tests = mapper.readTree(catalog.searchTests(body.path("query").asText(""), "si"));
        if (!tests.isArray() || tests.isEmpty()) {
            return ResponseEntity.ok(Map.of("found", false));
        }
        ArrayNode matches = mapper.createArrayNode();
        for (JsonNode test : tests) {
            if (matches.size() >= MAX_SPOKEN_MATCHES) {
                break;
            }
            ObjectNode match = matches.addObject();
            match.put("testCode", test.path("testCode").asText());
            match.put("spoken_en", formatter.spokenTestEn(test));
            match.put("spoken_si", formatter.spokenTestSi(test));
        }
        ObjectNode response = mapper.createObjectNode();
        response.put("found", true);
        response.set("matches", matches);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/list-packages")
    public ResponseEntity<Object> listPackages(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody JsonNode body) throws Exception {
        if (!authorized(token)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        JsonNode packages = mapper.readTree(catalog.listPackages("si"));
        if (!packages.isArray() || packages.isEmpty()) {
            return ResponseEntity.ok(Map.of("found", false));
        }
        ArrayNode spoken = mapper.createArrayNode();
        for (JsonNode pack : packages) {
            if (spoken.size() >= MAX_SPOKEN_MATCHES) {
                break;
            }
            ObjectNode entry = spoken.addObject();
            entry.put("packageCode", pack.path("packageCode").asText());
            entry.put("spoken_en", formatter.spokenPackageEn(pack));
            entry.put("spoken_si", formatter.spokenPackageSi(pack));
        }
        ObjectNode response = mapper.createObjectNode();
        response.put("found", true);
        response.set("packages", spoken);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/order-status")
    public ResponseEntity<Object> orderStatus(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody JsonNode body) throws Exception {
        if (!authorized(token)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        String orderNo = body.path("orderNo").asText("");
        String callerWaId = body.path("callerWaId").asText("");
        JsonNode status = mapper.readTree(catalog.getOrderStatus(orderNo, callerWaId));
        ObjectNode response = mapper.createObjectNode();
        response.put("spoken_en", formatter.spokenOrderEn(status));
        response.put("spoken_si", formatter.spokenOrderSi(status));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify-patient")
    public ResponseEntity<Object> verifyPatient(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody JsonNode body) throws Exception {
        if (!authorized(token)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        // callerWaId comes from the CALL event via the gateway, never from the model.
        JsonNode result = mapper.readTree(catalog.verifyPatient(
                body.path("identityNumber").asText(""),
                body.path("fullName").asText(""),
                body.path("callerWaId").asText("")));
        ObjectNode response = mapper.createObjectNode();
        boolean verified = result.path("verified").asBoolean(false);
        response.put("verified", verified);
        if (verified) {
            response.put("firstName", result.path("firstName").asText(""));
        }
        response.put("spoken_en", formatter.spokenPatientEn(result));
        response.put("spoken_si", formatter.spokenPatientSi(result));
        return ResponseEntity.ok(response);
    }

    private boolean authorized(String token) {
        if (!properties.isConfigured()) {
            return false;
        }
        boolean matches = MessageDigest.isEqual(
                properties.internalToken().getBytes(StandardCharsets.UTF_8),
                token == null ? new byte[0] : token.getBytes(StandardCharsets.UTF_8));
        if (!matches) {
            log.warn("Rejected voice tool call with a bad internal token");
        }
        return matches;
    }
}
