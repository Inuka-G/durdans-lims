package com.uom.lims.whatsapp.inbound;

import com.uom.lims.whatsapp.webhook.WebhookPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Turns a verified webhook payload into persisted conversation state.
 *
 * <p>This runs synchronously, before the controller acknowledges. That ordering is the
 * durability guarantee: Meta redelivers anything we do not acknowledge, so a message is
 * only ever lost if we return 200 without having stored it. Reasoning about the message
 * and replying happen later, off the request thread — those are allowed to fail and be
 * retried, because by then the message is safe.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InboundWebhookService {

    private static final String MESSAGES_FIELD = "messages";

    private final InboundMessageWriter writer;

    /**
     * @return how many messages were newly stored; redeliveries are not counted
     */
    public int ingest(WebhookPayload payload, String rawBody) {
        if (payload == null || payload.entry() == null) {
            return 0;
        }
        int stored = 0;
        for (WebhookPayload.Entry entry : payload.entry()) {
            if (entry == null || entry.changes() == null) {
                continue;
            }
            for (WebhookPayload.Change change : entry.changes()) {
                if (change == null || !MESSAGES_FIELD.equals(change.field()) || change.value() == null) {
                    // Other fields — delivery statuses on their own, account updates,
                    // calls — get their own listeners. Ignoring them here is not a gap.
                    continue;
                }
                stored += ingestValue(change.value(), rawBody);
            }
        }
        return stored;
    }

    private int ingestValue(WebhookPayload.Value value, String rawBody) {
        List<WebhookPayload.Message> messages = value.messages();
        if (messages == null || messages.isEmpty()) {
            return 0;
        }
        Map<String, String> namesByWaId = displayNames(value.contacts());

        int stored = 0;
        for (WebhookPayload.Message message : messages) {
            if (message == null || message.id() == null || message.from() == null) {
                log.warn("Skipping webhook message with no id or sender");
                continue;
            }
            if (writer.store(message, namesByWaId.get(message.from()), rawBody)) {
                stored++;
            }
        }
        return stored;
    }

    private static Map<String, String> displayNames(List<WebhookPayload.Contact> contacts) {
        if (contacts == null) {
            return Map.of();
        }
        return contacts.stream()
                .filter(c -> c != null && c.waId() != null && c.profile() != null && c.profile().name() != null)
                .collect(Collectors.toMap(
                        WebhookPayload.Contact::waId,
                        c -> c.profile().name(),
                        (first, second) -> first));
    }

    /**
     * The patient's words, whatever shape they arrived in. A button or list tap is as
     * much an answer as typed text, and the agent should not have to care which it was.
     */
    static String extractBody(WebhookPayload.Message message) {
        if (message.text() != null && message.text().body() != null) {
            return message.text().body();
        }
        if (message.button() != null && message.button().text() != null) {
            return message.button().text();
        }
        WebhookPayload.Interactive interactive = message.interactive();
        if (interactive != null) {
            if (interactive.buttonReply() != null) {
                return interactive.buttonReply().title();
            }
            if (interactive.listReply() != null) {
                return interactive.listReply().title();
            }
        }
        // Media, location and unsupported types carry no text. The raw payload is kept
        // on the row, so nothing is lost by returning null here.
        return null;
    }

    /**
     * Meta sends Unix seconds as a quoted string. A malformed value must not drop the
     * message: our clock is a worse record than Meta's, but it is a far better outcome
     * than losing what the patient said.
     */
    static Instant parseTimestamp(String epochSeconds) {
        if (epochSeconds == null || epochSeconds.isBlank()) {
            return Instant.now();
        }
        try {
            return Instant.ofEpochSecond(Long.parseLong(epochSeconds.trim()));
        } catch (NumberFormatException e) {
            return Instant.now();
        }
    }
}
