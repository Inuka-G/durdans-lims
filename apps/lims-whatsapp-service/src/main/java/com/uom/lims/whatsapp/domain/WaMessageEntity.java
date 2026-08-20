package com.uom.lims.whatsapp.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * One message in either direction.
 *
 * <p>{@code wamid} carries a unique constraint and that is deliberate: Meta redelivers
 * a webhook until it receives a 200, so the same message genuinely arrives more than
 * once. Deduplicating in application code would leave a race between two concurrent
 * deliveries; letting the unique index reject the second insert does not.
 */
@Entity
@Table(name = "wa_message")
@Getter
@Setter
public class WaMessageEntity extends WaBaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private WaConversationEntity conversation;

    @Enumerated(EnumType.STRING)
    @Column(name = "direction", nullable = false, length = 16)
    private MessageDirection direction;

    @Column(name = "wamid", nullable = false, unique = true, length = 128)
    private String wamid;

    /** Meta's message type: text, interactive, button, image, audio, location. */
    @Column(name = "message_type", nullable = false, length = 32)
    private String messageType;

    @Column(name = "body", columnDefinition = "text")
    private String body;

    @Column(name = "template_name", length = 128)
    private String templateName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private MessageStatus status;

    @Column(name = "failure_reason", length = 1024)
    private String failureReason;

    @Column(name = "meta_timestamp")
    private Instant metaTimestamp;

    @Column(name = "raw_payload", columnDefinition = "text")
    private String rawPayload;
}
