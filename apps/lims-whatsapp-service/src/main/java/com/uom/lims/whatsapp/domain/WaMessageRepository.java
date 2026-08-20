package com.uom.lims.whatsapp.domain;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WaMessageRepository extends JpaRepository<WaMessageEntity, UUID> {

    boolean existsByWamid(String wamid);

    Optional<WaMessageEntity> findByWamid(String wamid);

    /** Newest first; the agent reverses it into chronological order for the model. */
    List<WaMessageEntity> findByConversation_IdOrderByCreatedAtDesc(UUID conversationId, Pageable pageable);
}
