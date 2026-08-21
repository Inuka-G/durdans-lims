package com.uom.lims.whatsapp.voice;

import com.fasterxml.jackson.databind.JsonNode;
import com.uom.lims.whatsapp.domain.WaContactRepository;
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
import java.util.HashMap;
import java.util.Map;

/**
 * What the voice gateway may know about a caller before any verification: the WhatsApp
 * profile name Meta sent with their last message, if they have ever messaged. It is a
 * display name they chose — enough to say "Ayubowan, Kalana" and to ask "is that you?",
 * never enough to hand over anything. The identity step-up lives in the core, behind
 * {@code /internal/voice/tools/verify-patient}.
 *
 * <p>Its own controller rather than a method on {@link VoiceToolsController} so the tool
 * controller's dependency set — and its slice test — stay unchanged.
 */
@Slf4j
@RestController
@RequestMapping("/internal/voice/tools")
@RequiredArgsConstructor
public class VoiceCallerProfileController {

    private final VoiceProperties properties;
    private final WaContactRepository contactRepository;

    @PostMapping("/caller-profile")
    public ResponseEntity<Object> callerProfile(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody JsonNode body) {
        if (!properties.isConfigured() || !MessageDigest.isEqual(
                properties.internalToken().getBytes(StandardCharsets.UTF_8),
                token == null ? new byte[0] : token.getBytes(StandardCharsets.UTF_8))) {
            log.warn("Rejected caller-profile call with a bad internal token");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        String waId = body.path("callerWaId").asText("");
        Map<String, Object> response = new HashMap<>();
        response.put("known", false);
        if (!waId.isBlank()) {
            contactRepository.findByWaId(waId).ifPresent(contact -> {
                response.put("known", true);
                response.put("displayName", contact.getDisplayName() == null ? "" : contact.getDisplayName());
            });
        }
        return ResponseEntity.ok(response);
    }
}
