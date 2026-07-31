package com.uom.lims.patient;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface PatientRepository
                extends JpaRepository<PatientEntity, UUID>,
                JpaSpecificationExecutor<PatientEntity> {

        @Query(value = "SELECT nextval('patient_code_seq')", nativeQuery = true)
        Long getNextPatientSequence();

        boolean existsByPhone(String phone);

        Optional<PatientEntity> findByPhone(String phone);

        boolean existsByEmail(String email);

        Optional<PatientEntity> findByEmail(String email);

        boolean existsByIdentityNumber(String identityNumber);

        boolean existsByIdentityTypeAndIdentityNumber(
                        com.uom.lims.api.common.enums.IdentityType identityType,
                        String identityNumber);

        Optional<PatientEntity> findByIdentityTypeAndIdentityNumber(
                        com.uom.lims.api.common.enums.IdentityType identityType,
                        String identityNumber);

        Optional<PatientEntity> findByPatientCode(String patientCode);

        java.util.List<PatientEntity> findByPatientCodeIn(java.util.Collection<String> patientCodes);

        /** Soft-deleted, not-yet-anonymised patients whose retention window has elapsed. */
        java.util.List<PatientEntity> findByDeletedTrueAndAnonymizedFalseAndLastModifiedAtBefore(Instant cutoff);

        Page<PatientEntity> findByFullNameContainingIgnoreCaseOrPhoneContaining(
                        String fullName,
                        String phone,
                        Pageable pageable);

        Optional<PatientEntity> findByEmailVerificationTokenHash(String hash);

        long countByCreatedAtAfter(Instant dateTime);

        long countByBranchCodeAndCreatedAtAfter(String branchCode, Instant dateTime);

        long countByEmailVerifiedFalseAndPhoneVerifiedFalse();

        long countByBranchCodeAndEmailVerifiedFalseAndPhoneVerifiedFalse(String branchCode);
}
