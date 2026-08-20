package com.uom.lims.whatsapp.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WaContactRepository extends JpaRepository<WaContactEntity, UUID> {

    Optional<WaContactEntity> findByWaId(String waId);
}
