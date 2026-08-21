package com.uom.lims.agent;

import com.uom.lims.api.dto.request.AgentPatientVerifyRequest;
import com.uom.lims.api.dto.response.AgentPatientVerifyResponse;
import com.uom.lims.api.dto.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * WHY: the agent's identity step-up lives in the core, next to the patient data, so
 * the rule "possession plus knowledge, or nothing" is enforced where the data is —
 * identically for the chat agent, the voice agent, and whatever comes next. A POST
 * because an identity number has no business in a URL or an access log.
 */
@RestController
@RequestMapping("/api/v1/agent/patients")
@RequiredArgsConstructor
@PreAuthorize("hasRole('AGENT_READONLY')")
@Tag(name = "Agent Patients", description = "Identity step-up and recent orders for the WhatsApp agent")
public class AgentPatientController {

    private final AgentPatientVerifyService verifyService;

    @Operation(summary = "Verify a patient by phone possession plus stated name and identity number",
            description = "Returns the first name and recent orders only when all three agree with one record.")
    @PostMapping("/verify")
    public ResponseEntity<ApiResponse<AgentPatientVerifyResponse>> verify(
            @RequestBody AgentPatientVerifyRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                verifyService.verify(request.phone(), request.identityNumber(), request.fullName())));
    }
}
