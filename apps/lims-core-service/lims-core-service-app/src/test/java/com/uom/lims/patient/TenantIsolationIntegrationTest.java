package com.uom.lims.patient;

import com.uom.lims.AbstractIntegrationTest;
import com.uom.lims.api.common.enums.Gender;
import com.uom.lims.api.common.enums.IdentityType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.LocalDate;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Proves multi-tenant (branch) isolation end-to-end against a real database: a user
 * scoped to branch B001 can read their own patient, a user scoped to branch B002
 * cannot (and gets 404 so existence is not even leaked), a SUPER_ADMIN can read any
 * branch, and an unauthenticated caller is rejected.
 *
 * <p>This is the single most important control to demonstrate for a multi-branch
 * hospital system — and the one the audit found had ZERO automated coverage.
 */
class TenantIsolationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PatientRepository patientRepository;

    private static final String PATIENT_CODE = "P-TEN-001";

    @BeforeEach
    void seedPatientInBranchB001() {
        patientRepository.deleteAll();
        PatientEntity patient = new PatientEntity();
        patient.setPatientCode(PATIENT_CODE);
        patient.setFullName("Tenant Test Patient");
        patient.setDob(LocalDate.of(1990, 1, 1));
        patient.setGender(Gender.MALE);
        patient.setIdentityType(IdentityType.NIC);
        patient.setIdentityNumber("901234567V");
        patient.setPhone("+94770000001");
        patient.setAddress("123 Test Road, Colombo");
        patient.setBranchCode("B001");
        patient.setCreatedBy("test-seed");
        patientRepository.save(patient);
    }

    private static RequestPostProcessor branchUser(String branch, String role) {
        return jwt()
                .jwt(builder -> builder.claim("branch_code", branch).subject("user-" + branch))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Test
    void sameBranchUser_canReadOwnPatient() throws Exception {
        mockMvc.perform(get("/api/v1/patients/{code}", PATIENT_CODE)
                .with(branchUser("B001", "MLT")))
                .andExpect(status().isOk());
    }

    @Test
    void otherBranchUser_cannotReadPatient_andExistenceIsNotLeaked() throws Exception {
        mockMvc.perform(get("/api/v1/patients/{code}", PATIENT_CODE)
                .with(branchUser("B002", "MLT")))
                .andExpect(status().isNotFound());
    }

    @Test
    void superAdmin_canReadAnyBranchPatient() throws Exception {
        mockMvc.perform(get("/api/v1/patients/{code}", PATIENT_CODE)
                .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))))
                .andExpect(status().isOk());
    }

    @Test
    void unauthenticatedCaller_isRejected() throws Exception {
        mockMvc.perform(get("/api/v1/patients/{code}", PATIENT_CODE))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedButWrongRole_isForbidden() throws Exception {
        // DISPATCH_OFFICER is not in the @PreAuthorize allow-list for reading a
        // patient — method security must return 403 even for the patient's own branch.
        mockMvc.perform(get("/api/v1/patients/{code}", PATIENT_CODE)
                .with(branchUser("B001", "DISPATCH_OFFICER")))
                .andExpect(status().isForbidden());
    }
}
