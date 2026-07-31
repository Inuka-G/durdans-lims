package com.uom.lims.repository;

import com.uom.lims.entity.SupplyEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SupplyRepository extends JpaRepository<SupplyEntity, UUID> {

    List<SupplyEntity> findAllByDeletedFalseOrderByItemNoAsc();

    Optional<SupplyEntity> findByIdAndDeletedFalse(UUID id);

    boolean existsByItemNoIgnoreCaseAndDeletedFalse(String itemNo);

    boolean existsByNameIgnoreCaseAndDeletedFalse(String name);
}
