package com.uom.lims.whatsapp.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
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

    /**
     * Atomically claims the right to auto-reply on this conversation. Two inbound
     * messages seconds apart each fire an async reply attempt; a check-then-send in
     * Java leaves a window where both pass the check and the patient gets the same
     * greeting twice. One guarded UPDATE does not: the second caller sees the first
     * caller's timestamp and matches zero rows. Rolling back the sender's transaction
     * rolls the claim back with it, so a failed send does not burn the cooldown.
     *
     * @return 1 if this caller holds the claim, 0 if another send is too recent
     */
    @Modifying
    @Query("""
            update WaConversationEntity c set c.lastOutboundAt = :now
            where c.id = :id and (c.lastOutboundAt is null or c.lastOutboundAt < :threshold)""")
    int claimAutoReply(@Param("id") UUID id, @Param("now") Instant now, @Param("threshold") Instant threshold);
}
