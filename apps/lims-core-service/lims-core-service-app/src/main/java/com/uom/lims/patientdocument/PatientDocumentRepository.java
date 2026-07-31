package com.uom.lims.patientdocument;

import com.uom.lims.patient.PatientEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatientDocumentRepository
                extends JpaRepository<PatientDocumentEntity, UUID> {

        List<PatientDocumentEntity> findByPatientId(UUID patientId);

        Page<PatientDocumentEntity> findByPatient_PatientCodeAndDeletedFalse(
                        String patientCode,
                        Pageable pageable);

        Optional<PatientDocumentEntity> findByIdAndPatient_PatientCode(
                        UUID id,
                        String patientCode);

        boolean existsByPatientAndFileHash(PatientEntity patient, String fileHash);

}
