package com.uom.lims.repository;

import com.uom.lims.entity.BranchTestEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BranchTestRepository extends JpaRepository<BranchTestEntity, UUID> {
    List<BranchTestEntity> findByBranchId(UUID branchId);
}
