package com.uom.lims.branchuser;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

import java.util.UUID;

@Repository
public interface BranchUserRepository extends JpaRepository<BranchUserEntity, UUID>, JpaSpecificationExecutor<BranchUserEntity> {
    
    Optional<BranchUserEntity> findByEmail(String email);
    
    Optional<BranchUserEntity> findByKeycloakId(String keycloakId);
    
    java.util.List<BranchUserEntity> findByBranchId(String branchId);
    
    boolean existsByEmailAndIdNot(String email, UUID id);
    
    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByUsernameAndIdNot(String username, UUID id);
}
