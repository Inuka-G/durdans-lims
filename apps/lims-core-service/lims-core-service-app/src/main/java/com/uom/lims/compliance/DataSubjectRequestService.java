package com.uom.lims.compliance;

import com.uom.lims.audit.AuditService;
import com.uom.lims.exception.ResourceNotFoundException;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Sri Lanka PDPA data-subject-request handling: consent capture, the right of
 * access (data export) and the right to erasure (anonymisation). Health data is
 * a special category, so these operations are audited and erasure de-identifies
 * the record while retaining the clinical results (linked by the anonymised id)
 * for the legally-required retention period.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataSubjectRequestService {

    private final PatientRepository patientRepository;
    private final OrderRepository orderRepository;
    private final AuditService auditService;
    private final com.uom.lims.patientdocument.PatientDocumentStorageService storageService;

    /** Record the patient's consent to process their health data. */
    @Transactional
    public void recordConsent(String patientCode, String consentVersion, String ipAddress) {
        PatientEntity patient = require(patientCode);
        // Tenant isolation: only record consent for a patient in the caller's branch.
        if (!com.uom.lims.security.SecurityUtils.canAccessBranch(patient.getBranchCode())) {
            throw new ResourceNotFoundException("Patient not found: " + patientCode);
        }
        patient.setConsentGiven(true);
        patient.setConsentAt(LocalDateTime.now());
        patient.setConsentVersion(consentVersion);
        patientRepository.save(patient);
        auditService.log("PDPA_CONSENT_RECORDED", "PATIENT", patient.getId(), patientCode,
                String.format("{\"version\":\"%s\"}", consentVersion), ipAddress);
    }

    /** Right of access: assemble the data held about the patient. */
    @Transactional(readOnly = true)
    public PatientDataExport export(String patientCode, String ipAddress) {
        PatientEntity p = require(patientCode);
        long orderCount = orderRepository.countByPatientIdAndDeletedFalse(patientCode);
        auditService.log("PDPA_DATA_EXPORT", "PATIENT", p.getId(), patientCode, "{}", ipAddress);
        return new PatientDataExport(
                p.getPatientCode(), p.getFullName(), p.getDob(), p.getGender() == null ? null : p.getGender().name(),
                p.getEmail(), p.getPhone(), p.getIdentityNumber(), p.getAddress(), p.getBranchCode(),
                p.isConsentGiven(), p.getConsentVersion(), orderCount);
    }

    /**
     * Right to erasure: de-identify the patient record. Unique not-null columns
     * (phone) get a stable anonymised placeholder; the rest of the PII is cleared.
     * Clinical results remain linked to the (now anonymised) patient for retention.
     */
    @Transactional
    public void erase(String patientCode, String reason, String ipAddress) {
        PatientEntity p = require(patientCode);
        if (p.isAnonymized()) {
            return;
        }
        redact(p);
        patientRepository.save(p);
        auditService.log("PDPA_ERASURE", "PATIENT", p.getId(), patientCode,
                String.format("{\"reason\":\"%s\"}", reason == null ? "" : reason), ipAddress);
        log.info("Patient {} anonymised under right-to-erasure", com.uom.lims.util.PiiMasker.maskCode(patientCode));
    }

    /**
     * Retention enforcement: anonymise soft-deleted patient records whose retention
     * window has elapsed. Called by the scheduled retention job.
     */
    @Transactional
    public int anonymizeExpired(int retentionDays) {
        Instant cutoff = Instant.now().minus(Duration.ofDays(retentionDays));
        List<PatientEntity> expired =
                patientRepository.findByDeletedTrueAndAnonymizedFalseAndLastModifiedAtBefore(cutoff);
        for (PatientEntity p : expired) {
            redact(p);
            patientRepository.save(p);
            auditService.log("PDPA_RETENTION_ANONYMIZED", "PATIENT", p.getId(), p.getPatientCode(),
                    String.format("{\"retentionDays\":%d}", retentionDays), "0.0.0.0");
        }
        if (!expired.isEmpty()) {
            log.info("Retention: anonymised {} expired patient record(s)", expired.size());
        }
        return expired.size();
    }

    /** De-identify PII in place. Phone is unique+not-null so it gets a stable placeholder. */
    private void redact(PatientEntity p) {
        p.setFullName("REDACTED");
        p.setEmail(null);
        p.setPhone("ANON-" + p.getPatientCode());
        p.setIdentityNumber(null);
        p.setIdentityType(null);
        p.setAddress("REDACTED");
        p.setHomeNumber(null);
        p.setContactPersonName(null);
        p.setContactPersonPhone(null);
        // Additional identifying / special-category fields.
        p.setTitle(null);
        p.setMaritalStatus(null);
        p.setNationality(null);
        p.setBloodGroup(null);
        // Clear residual auth/verification artifacts (token + OTP hashes).
        p.setPhoneOtpHash(null);
        p.setPhoneOtpExpiry(null);
        p.setLastOtpSentAt(null);
        p.setEmailVerificationTokenHash(null);
        p.setEmailVerificationExpiry(null);
        p.setLastVerificationSentAt(null);
        // Delete the profile photo object from storage, then clear the path.
        String photoPath = p.getProfilePhotoPath();
        if (photoPath != null && !photoPath.isBlank()) {
            try {
                storageService.deleteFile(photoPath);
            } catch (Exception e) {
                log.warn("Could not delete profile photo for erased patient {}", p.getPatientCode(), e);
            }
        }
        p.setProfilePhotoPath(null);
        if (p.getDob() != null) {
            p.setDob(LocalDate.of(p.getDob().getYear(), 1, 1)); // de-identify DOB to birth year
        }
        p.setAnonymized(true);
        p.setDeleted(true);
    }

    private PatientEntity require(String patientCode) {
        return patientRepository.findByPatientCode(patientCode)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found: " + patientCode));
    }

    /** Access-right export payload. */
    public record PatientDataExport(String patientCode, String fullName, LocalDate dob, String gender,
                                    String email, String phone, String identityNumber, String address,
                                    String branchCode, boolean consentGiven, String consentVersion,
                                    long orderCount) {
    }
}
