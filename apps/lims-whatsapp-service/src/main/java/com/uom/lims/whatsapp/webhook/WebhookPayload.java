package com.uom.lims.whatsapp.webhook;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * The shape of a WhatsApp Cloud API webhook, modelled only as far as this service
 * needs it.
 *
 * <p>Every record ignores unknown properties. Meta adds fields to these payloads
 * without notice, and a deserialization failure here would mean returning a non-200,
 * which makes Meta retry the same payload until it eventually stops delivering — an
 * outage caused by a field we did not care about.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record WebhookPayload(String object, List<Entry> entry) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Entry(String id, List<Change> changes) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Change(String field, Value value) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Value(
            @JsonProperty("messaging_product") String messagingProduct,
            Metadata metadata,
            List<Contact> contacts,
            List<Message> messages,
            List<Status> statuses) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Metadata(
            @JsonProperty("display_phone_number") String displayPhoneNumber,
            @JsonProperty("phone_number_id") String phoneNumberId) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Contact(@JsonProperty("wa_id") String waId, Profile profile) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Profile(String name) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Message(
            String id,
            String from,
            /* Unix seconds, as a string. Meta sends it quoted. */
            String timestamp,
            String type,
            Text text,
            Button button,
            Interactive interactive) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Text(String body) {
    }

    /** A quick-reply tap on a template message. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Button(String payload, String text) {
    }

    /** A tap on an interactive list or button message. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Interactive(
            String type,
            @JsonProperty("button_reply") Reply buttonReply,
            @JsonProperty("list_reply") Reply listReply) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Reply(String id, String title) {
    }

    /** Delivery receipt for a message we sent. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Status(
            String id,
            String status,
            String timestamp,
            @JsonProperty("recipient_id") String recipientId) {
    }
}
