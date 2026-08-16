package com.uom.lims.instrument;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InstrumentRepository extends JpaRepository<InstrumentEntity, String> {

    Optional<InstrumentEntity> findByCodeAndActiveTrue(String code);

    List<InstrumentEntity> findByActiveTrueOrderByNameAsc();
}
