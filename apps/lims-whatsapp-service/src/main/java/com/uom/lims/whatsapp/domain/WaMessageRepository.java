package com.uom.lims.whatsapp.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface WaMessageRepository extends JpaRepository<WaMessageEntity, UUID> {

    boolean existsByWamid(String wamid);
}
