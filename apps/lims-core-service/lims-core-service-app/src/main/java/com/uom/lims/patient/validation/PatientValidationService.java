package com.uom.lims.patient.validation;

import com.uom.lims.api.common.enums.IdentityType;
import com.uom.lims.exception.DuplicateResourceException;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PatientValidationService {

    private final PatientRepository patientRepository;

    public void validateIdentityUnique(IdentityType type, String identityNumber, String excludePatientCode) {
        if (type == null || identityNumber == null) {
            return;
        }

        Optional<PatientEntity> existing = patientRepository.findByIdentityTypeAndIdentityNumber(type, identityNumber);

        if (existing.isPresent()) {
            // If excludePatientCode is provided, check if it's the SAME patient
            if (excludePatientCode != null && existing.get().getPatientCode().equals(excludePatientCode)) {
                return; // It's the same patient, so valid
            }
            // Otherwise, it's a duplicate
            throw new DuplicateResourceException("Identity number already exists");
        }
    }

    public void validatePhoneUnique(String phone, String excludePatientCode) {
        if (phone == null) {
            return;
        }

        Optional<PatientEntity> existing = patientRepository.findByPhone(phone);

        if (existing.isPresent()) {
            if (excludePatientCode != null && existing.get().getPatientCode().equals(excludePatientCode)) {
                return;
            }
            throw new DuplicateResourceException("Phone number already exists");
        }
    }

    public void validateEmailUnique(String email, String excludePatientCode) {
        if (email == null) {
            return;
        }

        Optional<PatientEntity> existing = patientRepository.findByEmail(email);

        if (existing.isPresent()) {
            if (excludePatientCode != null && existing.get().getPatientCode().equals(excludePatientCode)) {
                return;
            }
            throw new DuplicateResourceException("Email already exists");
        }
    }
}
