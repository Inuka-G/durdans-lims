package com.uom.lims.branchuser;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

import java.util.UUID;

@Repository
public interface BranchUserRepository extends JpaRepository<BranchUserEntity, UUID>, JpaSpecificationExecutor<BranchUserEntity> {
    
    Optional<BranchUserEntity> findByEmail(String email);
    
    boolean existsByEmailAndIdNot(String email, UUID id);
    
    boolean existsByEmail(String email);
}
