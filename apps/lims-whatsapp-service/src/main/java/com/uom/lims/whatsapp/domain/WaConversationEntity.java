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

import java.time.Duration;
import java.time.Instant;

/**
 * One ongoing conversation with a contact, and — the part that matters operationally —
 * the state of WhatsApp's 24-hour customer service window.
 *
 * <p>Outside that window Meta accepts only pre-approved template messages. Getting this
 * wrong does not surface as an exception at the call site; it surfaces as a silently
 * undelivered reply to a patient waiting for an answer. So the window is modelled
 * explicitly and {@link #canSendFreeForm(Instant)} is the single place that decides.
 */
@Entity
@Table(name = "wa_conversation")
@Getter
@Setter
public class WaConversationEntity extends WaBaseEntity {

    /** Meta's customer service window: 24 hours from the last inbound message. */
    public static final Duration SERVICE_WINDOW = Duration.ofHours(24);

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contact_id", nullable = false)
    private WaContactEntity contact;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false, length = 24)
    private ConversationState state = ConversationState.OPEN;

    @Column(name = "window_expires_at")
    private Instant windowExpiresAt;

    @Column(name = "last_inbound_at")
    private Instant lastInboundAt;

    @Column(name = "last_outbound_at")
    private Instant lastOutboundAt;

    @Column(name = "handoff_requested_at")
    private Instant handoffRequestedAt;

    @Column(name = "assigned_staff", length = 128)
    private String assignedStaff;

    /**
     * Records an inbound message and reopens the service window from it. Every inbound
     * message resets the window, including a quick-reply button tap — which is exactly
     * how a one-way template notification turns back into a conversation.
     */
    public void registerInbound(Instant at) {
        this.lastInboundAt = at;
        this.windowExpiresAt = at.plus(SERVICE_WINDOW);
    }

    public void registerOutbound(Instant at) {
        this.lastOutboundAt = at;
    }

    /**
     * Whether a free-form (non-template) message may be sent right now. Callers must
     * fall back to an approved template when this is false rather than sending anyway
     * and letting Meta reject it.
     */
    public boolean canSendFreeForm(Instant now) {
        return windowExpiresAt != null && now.isBefore(windowExpiresAt);
    }
}
