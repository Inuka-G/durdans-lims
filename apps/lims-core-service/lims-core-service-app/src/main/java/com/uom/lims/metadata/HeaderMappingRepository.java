package com.uom.lims.metadata;

import com.uom.lims.entity.HeaderMappingEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface HeaderMappingRepository extends JpaRepository<HeaderMappingEntity, UUID> {
    List<HeaderMappingEntity> findAllByRoleNameInOrderByPriorityAsc(List<String> roleNames);
}
