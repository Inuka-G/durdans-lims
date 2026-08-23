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
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * What the voice gateway may know about a caller before any verification: the WhatsApp
 * profile name Meta sent with their last message, the language they last wrote in, and
 * a one-line note about what their previous call was about. It is a display name they
 * chose and a topic they raised — enough to say "Ayubowan, Kalana" and "පහුගිය සැරේ
 * report එක ගැනද?", never enough to hand over anything. The identity step-up lives in
 * the core, behind {@code /internal/voice/tools/verify-patient}.
 *
 * <p>Its own controller rather than a method on {@link VoiceToolsController} so the tool
 * controller's dependency set — and its slice test — stay unchanged. The write side of
 * the same memory is {@link VoiceCallMemoryController}.
 */
@Slf4j
@RestController
@RequestMapping("/internal/voice/tools")
@RequiredArgsConstructor
public class VoiceCallerProfileController {

    /**
     * Past this, a memory stops helping and starts being strange: nobody warmly recalls
     * a phone call from four months ago, and pretending to is worse than a clean start.
     */
    private static final Duration MEMORY_HORIZON = Duration.ofDays(90);

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
                response.put("locale", contact.getLocale() == null ? "" : contact.getLocale());
                Instant lastCall = contact.getLastCallAt();
                String summary = contact.getLastCallSummary();
                if (lastCall != null && summary != null && !summary.isBlank() && isRecent(lastCall)) {
                    response.put("lastCallSummary", summary);
                    response.put("lastCallOn", relativeDay(lastCall));
                }
            });
        }
        return ResponseEntity.ok(response);
    }

    private boolean isRecent(Instant when) {
        return !when.isBefore(Instant.now().minus(MEMORY_HORIZON));
    }

    /**
     * How long ago, said the way a person says it. The gateway hands this straight to the
     * model, which renders it in whatever language the call is running in — which is why
     * it is a phrase and not a date: "පහුගිය සතියේ" reads as memory, "2026-08-16" reads
     * as a database.
     */
    private String relativeDay(Instant when) {
        long days = Duration.between(when, Instant.now()).toDays();
        if (days <= 0) {
            return "today";
        }
        if (days == 1) {
            return "yesterday";
        }
        if (days < 7) {
            return days + " days ago";
        }
        if (days < 14) {
            return "last week";
        }
        if (days < 60) {
            return (days / 7) + " weeks ago";
        }
        return "a couple of months ago";
    }
}
