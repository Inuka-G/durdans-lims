package com.uom.lims.refrange;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReferenceRangeRepository extends JpaRepository<ReferenceRangeEntity, UUID> {

    List<ReferenceRangeEntity> findByParameterId(UUID parameterId);
}
