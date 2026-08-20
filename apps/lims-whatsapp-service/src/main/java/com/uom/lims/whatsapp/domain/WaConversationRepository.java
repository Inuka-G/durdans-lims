package com.uom.lims.whatsapp.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WaConversationRepository extends JpaRepository<WaConversationEntity, UUID> {

    /**
     * The conversation currently being served for a contact. A contact has at most one
     * that is not CLOSED; a new inbound message after closure starts a fresh one so the
     * transcript boundaries stay meaningful for audit.
     */
    Optional<WaConversationEntity> findFirstByContactAndStateNotOrderByCreatedAtDesc(
            WaContactEntity contact, ConversationState state);
}
