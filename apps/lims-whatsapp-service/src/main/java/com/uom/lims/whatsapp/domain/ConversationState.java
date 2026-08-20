package com.uom.lims.whatsapp.domain;

public enum ConversationState {
    /** The agent is answering. */
    OPEN,
    /** A human has taken over; the agent must not send into this conversation. */
    HANDED_OFF,
    /** Resolved or abandoned. A new inbound message reopens it. */
    CLOSED
}
