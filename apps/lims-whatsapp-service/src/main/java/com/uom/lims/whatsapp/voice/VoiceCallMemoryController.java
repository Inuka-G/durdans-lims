package com.uom.lims.whatsapp.voice;

import com.fasterxml.jackson.databind.JsonNode;
import com.uom.lims.whatsapp.domain.WaContactEntity;
import com.uom.lims.whatsapp.domain.WaContactRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

/**
 * The write half of caller memory: one topic line per finished voice call.
 *
 * <p>The contract this endpoint enforces, rather than trusts: what lands in the column
 * is a SUBJECT, never speech. The gateway derives it from which tools ran, so a caller
 * who reads out a NIC to be verified leaves behind "report status" and nothing else —
 * but the endpoint is reachable by anything holding the internal token, so the value is
 * scrubbed and capped here too. Nothing clinical crosses this boundary; the column lives
 * in the WhatsApp database, which holds no patient data by design.
 *
 * <p>The read half is {@link VoiceCallerProfileController}.
 */
@Slf4j
@RestController
@RequestMapping("/internal/voice/tools")
@RequiredArgsConstructor
public class VoiceCallMemoryController {

    private static final int MAX_SUMMARY_LENGTH = 180;
    private static final Set<String> SUPPORTED_LOCALES = Set.of("si", "ta", "en");

    private final VoiceProperties properties;
    private final WaContactRepository contactRepository;

    @PostMapping("/call-memory")
    @Transactional
    public ResponseEntity<Object> remember(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody JsonNode body) {
        if (!properties.isConfigured() || !MessageDigest.isEqual(
                properties.internalToken().getBytes(StandardCharsets.UTF_8),
                token == null ? new byte[0] : token.getBytes(StandardCharsets.UTF_8))) {
            log.warn("Rejected call-memory write with a bad internal token");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        String waId = body.path("callerWaId").asText("").trim();
        String summary = scrub(body.path("summary").asText(""));
        if (waId.isBlank() || summary.isBlank()) {
            // Nothing worth remembering is a normal outcome, not an error: a call where
            // no tool ran had no subject.
            return ResponseEntity.ok(Map.of("stored", false));
        }

        String locale = body.path("locale").asText("").trim().toLowerCase();
        WaContactEntity contact = findOrCreate(waId, locale);
        contact.setLastCallSummary(summary);
        contact.setLastCallAt(Instant.now());
        if (SUPPORTED_LOCALES.contains(locale)) {
            // The language they actually spoke on the call is fresher evidence than the
            // language they last typed in.
            contact.setLocale(locale);
        }
        contactRepository.save(contact);
        return ResponseEntity.ok(Map.of("stored", true));
    }

    /**
     * A caller who has only ever phoned us has no contact row — the inbound message
     * writer is what usually creates one. A call is an interaction too, so we create it
     * here, tolerating the unique constraint if a message lands in the same instant.
     */
    private WaContactEntity findOrCreate(String waId, String locale) {
        return contactRepository.findByWaId(waId).orElseGet(() -> {
            WaContactEntity created = new WaContactEntity();
            created.setWaId(waId);
            created.setLocale(SUPPORTED_LOCALES.contains(locale) ? locale : "si");
            try {
                return contactRepository.saveAndFlush(created);
            } catch (DataIntegrityViolationException race) {
                return contactRepository.findByWaId(waId).orElseThrow(() -> race);
            }
        });
    }

    /**
     * Collapse anything that is not plain single-line text, then cap it. Control
     * characters in a value we later feed to a model are worth removing on principle.
     */
    private String scrub(String raw) {
        if (raw == null) {
            return "";
        }
        String cleaned = raw.replaceAll("[\\p{Cntrl}]", " ").replaceAll("\\s+", " ").trim();
        return cleaned.length() > MAX_SUMMARY_LENGTH ? cleaned.substring(0, MAX_SUMMARY_LENGTH) : cleaned;
    }
}
