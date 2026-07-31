package com.uom.lims.dispatch;

import com.uom.lims.api.common.PageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DispatchController.class)
class DispatchControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DispatchService dispatchService;

    @Test
    void listReports_unauthenticated() throws Exception {
        mockMvc.perform(get("/api/v1/dispatch/reports"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listReports_ok_forDispatchOfficer() throws Exception {
        when(dispatchService.listDispatchReports(isNull(), isNull(), isNull(), anyInt(), anyInt(), anyString()))
                .thenReturn(new PageResponse<>(List.of(), 0, 10, 0, 0, true));

        mockMvc.perform(get("/api/v1/dispatch/reports")
                        .with(SecurityMockMvcRequestPostProcessors.jwt()
                                .authorities(new SimpleGrantedAuthority("ROLE_DISPATCH_OFFICER"))))
                .andExpect(status().isOk());
    }
}
