package com.uom.lims.patient;

import com.uom.lims.api.patient.dto.response.PatientResponse;
import com.uom.lims.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Who may look a patient up. A billing officer has to find the patient before an
 * order can be raised for them, so leaving BILLING_OFFICER off the search endpoint
 * made the billing module unusable on its own — the symptom was an empty patient
 * picker, because the browser only logs the 403.
 *
 * SecurityConfig is imported rather than left to the slice defaults: it carries
 * @EnableMethodSecurity, and without it @PreAuthorize is never evaluated and every
 * assertion below would pass for the wrong reason. AopAutoConfiguration comes with it
 * because the slice does not include it — method security would then proxy this
 * controller through its PatientApi interface with JDK proxies, the request mappings
 * would not be detected, and every request would 404 instead of being authorized.
 * The JwtDecoder is mocked only so the resource-server chain can be built; jwt() seeds
 * the authentication directly, so no token is ever decoded.
 */
@WebMvcTest(PatientController.class)
@Import({ SecurityConfig.class, AopAutoConfiguration.class })
class PatientControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PatientService patientService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    private void stubSearch() {
        Page<PatientResponse> empty = new PageImpl<>(List.of());
        when(patientService.searchPatients(anyString(), anyInt(), anyInt(), anyString(), anyString()))
                .thenReturn(empty);
    }

    private static JwtRequestPostProcessor as(String role) {
        return SecurityMockMvcRequestPostProcessors.jwt()
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Test
    void searchPatients_unauthenticated() throws Exception {
        mockMvc.perform(get("/api/v1/patients"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void searchPatients_branchBrowse_ok_forBillingOfficer() throws Exception {
        stubSearch();

        // No keyword: the service scopes this to the caller's own branch.
        mockMvc.perform(get("/api/v1/patients").with(as("BILLING_OFFICER")))
                .andExpect(status().isOk());
    }

    @Test
    void searchPatients_globalKeyword_ok_forBillingOfficer() throws Exception {
        stubSearch();

        // With a keyword the search spans branches, so a patient registered at
        // another branch can still be billed here.
        mockMvc.perform(get("/api/v1/patients").param("keyword", "Perera").with(as("BILLING_OFFICER")))
                .andExpect(status().isOk());
    }

    @Test
    void searchPatients_ok_forFrontDesk() throws Exception {
        stubSearch();

        mockMvc.perform(get("/api/v1/patients").with(as("FRONT_DESK")))
                .andExpect(status().isOk());
    }

    @Test
    void searchPatients_forbidden_forRoleWithNoPatientBusiness() throws Exception {
        mockMvc.perform(get("/api/v1/patients").with(as("DISPATCH_OFFICER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void getPatientByCode_forbidden_forBillingOfficer() throws Exception {
        // Deliberate boundary, not an oversight: billing needs to *find* a patient
        // to raise an order, not to open their profile — and the frontend gives a
        // billing-only user no patient-profile route. Widen this the day it does.
        mockMvc.perform(get("/api/v1/patients/P-0001").with(as("BILLING_OFFICER")))
                .andExpect(status().isForbidden());
    }
}
