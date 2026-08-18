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

import org.springframework.http.MediaType;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Proves multi-tenant (branch) isolation end-to-end against a real database.
 *
 * <p>The boundary is drawn between <b>reading</b> a patient and <b>owning</b> one.
 * A patient is a hospital-wide record: someone registered at B001 has to be
 * findable and servable at B002 without being registered twice, so reads and
 * keyword searches deliberately cross branches. Ownership does not: another
 * branch cannot rename a patient, and no branch user can move a patient out of
 * their branch. Roles and authentication gate everything as before.
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
    private static final String OTHER_BRANCH_PATIENT_CODE = "P-TEN-002";

    @BeforeEach
    void seedOnePatientPerBranch() {
        patientRepository.deleteAll();
        patientRepository.save(patient(PATIENT_CODE, "Tenant Test Patient", "901234567V",
                "+94770000001", "B001"));
        // A second patient in B002 so the search tests can tell "my branch only"
        // apart from "every branch" instead of both returning the same one row.
        patientRepository.save(patient(OTHER_BRANCH_PATIENT_CODE, "Kandy Branch Patient", "902234567V",
                "+94770000002", "B002"));
    }

    private static PatientEntity patient(String code, String name, String nic, String phone, String branch) {
        PatientEntity patient = new PatientEntity();
        patient.setPatientCode(code);
        patient.setFullName(name);
        patient.setDob(LocalDate.of(1990, 1, 1));
        patient.setGender(Gender.MALE);
        patient.setIdentityType(IdentityType.NIC);
        patient.setIdentityNumber(nic);
        patient.setPhone(phone);
        patient.setAddress("123 Test Road, Colombo");
        patient.setBranchCode(branch);
        patient.setCreatedBy("test-seed");
        return patient;
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
    void otherBranchUser_canReadPatient_soTheyCanBeServedAtAnyBranch() throws Exception {
        // A patient walking into B002 having registered at B001 must be found and
        // served there, not registered a second time. Reads therefore cross branches
        // (the access is audited); ownership still does not — see the write tests.
        mockMvc.perform(get("/api/v1/patients/{code}", PATIENT_CODE)
                .with(branchUser("B002", "MLT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.patientCode").value(PATIENT_CODE))
                .andExpect(jsonPath("$.branchCode").value("B001"));
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

    // ------------------------------------------------------------------
    // Search paths.
    //
    // Browsing and looking someone up are scoped differently on purpose: a bare
    // listing is the branch's own register, a keyword is a search for one named
    // person and has to reach every branch or the front desk cannot serve them.
    // ------------------------------------------------------------------

    @Test
    void keywordSearch_findsPatientRegisteredAtAnotherBranch() throws Exception {
        mockMvc.perform(get("/api/v1/patients")
                .param("keyword", "Kandy Branch")
                .with(branchUser("B001", "FRONT_DESK")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].patientCode").value(OTHER_BRANCH_PATIENT_CODE))
                .andExpect(jsonPath("$.content[0].branchCode").value("B002"));
    }

    @Test
    void keywordSearch_matchesOnPatientCodeAndNic_acrossBranches() throws Exception {
        mockMvc.perform(get("/api/v1/patients")
                .param("keyword", OTHER_BRANCH_PATIENT_CODE)
                .with(branchUser("B001", "FRONT_DESK")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].patientCode").value(OTHER_BRANCH_PATIENT_CODE));

        mockMvc.perform(get("/api/v1/patients")
                .param("keyword", "902234567V")
                .with(branchUser("B001", "FRONT_DESK")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].patientCode").value(OTHER_BRANCH_PATIENT_CODE));
    }

    @Test
    void blankSearch_listsOwnBranchOnly() throws Exception {
        // No keyword is a browse, not a lookup — it must not dump every branch's
        // register, and it is what the branch dashboard counts.
        mockMvc.perform(get("/api/v1/patients")
                .with(branchUser("B001", "FRONT_DESK")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].patientCode").value(PATIENT_CODE));
    }

    @Test
    void bareBranchCodeFilter_cannotEnumerateAnotherBranchsRegister() throws Exception {
        // ?branchCode=B002 with no identifying filter is enumeration, not a patient
        // lookup: the caller stays pinned to their own branch.
        mockMvc.perform(get("/api/v1/patients")
                .param("branchCode", "B002")
                .with(branchUser("B001", "FRONT_DESK")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].patientCode").value(PATIENT_CODE));
    }

    @Test
    void identifyingFilter_reachesAcrossBranches() throws Exception {
        mockMvc.perform(get("/api/v1/patients")
                .param("fullName", "Kandy Branch Patient")
                .with(branchUser("B001", "FRONT_DESK")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].patientCode").value(OTHER_BRANCH_PATIENT_CODE));
    }

    // ------------------------------------------------------------------
    // Write paths.
    //
    // The read guards above were in place while every write path loaded by id
    // and mutated with no branch check at all, so isolation held for looking and
    // not for touching. These pin the write side.
    // ------------------------------------------------------------------

    private static String updateBody(String fullName, String branchCode) {
        String branch = branchCode == null ? "" : ",\"branchCode\":\"" + branchCode + "\"";
        return "{\"fullName\":\"" + fullName + "\",\"phone\":\"+94770000001\"" + branch + "}";
    }

    @Test
    void sameBranchUser_canUpdateOwnPatient() throws Exception {
        mockMvc.perform(put("/api/v1/patients/{code}", PATIENT_CODE)
                .with(branchUser("B001", "FRONT_DESK"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(updateBody("Renamed By Own Branch", null)))
                .andExpect(status().isOk());
    }

    @Test
    void otherBranchUser_cannotUpdatePatient_andExistenceIsNotLeaked() throws Exception {
        mockMvc.perform(put("/api/v1/patients/{code}", PATIENT_CODE)
                .with(branchUser("B002", "FRONT_DESK"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(updateBody("Renamed By Other Branch", null)))
                .andExpect(status().isNotFound());

        // The write must not have landed.
        PatientEntity after = patientRepository.findByPatientCode(PATIENT_CODE).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("Tenant Test Patient", after.getFullName());
    }

    @Test
    void branchUser_cannotMovePatientToAnotherBranch() throws Exception {
        // branchCode was mass-assignable: a branch user could push a patient — and
        // that patient's whole order and result history — out of their own branch.
        mockMvc.perform(put("/api/v1/patients/{code}", PATIENT_CODE)
                .with(branchUser("B001", "FRONT_DESK"))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(updateBody("Tenant Test Patient", "B002")))
                .andExpect(status().isForbidden());

        PatientEntity after = patientRepository.findByPatientCode(PATIENT_CODE).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("B001", after.getBranchCode());
    }

    @Test
    void superAdmin_mayMovePatientBetweenBranches() throws Exception {
        mockMvc.perform(put("/api/v1/patients/{code}", PATIENT_CODE)
                .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(updateBody("Tenant Test Patient", "B002")))
                .andExpect(status().isOk());

        PatientEntity after = patientRepository.findByPatientCode(PATIENT_CODE).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("B002", after.getBranchCode());
    }
}
