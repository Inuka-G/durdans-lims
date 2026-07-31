package com.uom.lims.compliance;

import com.uom.lims.audit.AuditService;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataSubjectRequestServiceTest {

    @Mock PatientRepository patientRepository;
    @Mock OrderRepository orderRepository;
    @Mock AuditService auditService;
    @Mock com.uom.lims.patientdocument.PatientDocumentStorageService storageService;
    @InjectMocks DataSubjectRequestService service;

    @Test
    void eraseRedactsPiiButKeepsStableId() {
        PatientEntity p = new PatientEntity();
        p.setId(UUID.randomUUID());
        p.setPatientCode("PAT2026-00042");
        p.setFullName("Nimal Perera");
        p.setEmail("nimal@example.com");
        p.setPhone("0771234567");
        p.setIdentityNumber("199012345678");
        p.setAddress("12 Galle Road, Colombo");
        p.setContactPersonName("Kamala");
        p.setNationality("Sri Lankan");
        p.setPhoneOtpHash("otp-hash");
        p.setEmailVerificationTokenHash("email-token-hash");
        p.setDob(LocalDate.of(1990, 2, 2));

        when(patientRepository.findByPatientCode("PAT2026-00042")).thenReturn(Optional.of(p));

        service.erase("PAT2026-00042", "patient request", "0.0.0.0");

        ArgumentCaptor<PatientEntity> captor = ArgumentCaptor.forClass(PatientEntity.class);
        org.mockito.Mockito.verify(patientRepository).save(captor.capture());
        PatientEntity saved = captor.getValue();

        assertEquals("REDACTED", saved.getFullName());
        assertNull(saved.getEmail());
        assertNull(saved.getIdentityNumber());
        assertEquals("REDACTED", saved.getAddress());
        assertNull(saved.getContactPersonName());
        assertNull(saved.getNationality());
        assertNull(saved.getPhoneOtpHash());
        assertNull(saved.getEmailVerificationTokenHash());
        // Phone is unique+not-null: replaced with a stable anonymised placeholder.
        assertEquals("ANON-PAT2026-00042", saved.getPhone());
        // DOB de-identified to birth year only.
        assertEquals(LocalDate.of(1990, 1, 1), saved.getDob());
        assertTrue(saved.isAnonymized());
        assertTrue(saved.isDeleted());
    }
}
