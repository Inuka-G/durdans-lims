package com.uom.lims.agent;

import com.uom.lims.api.dto.response.AgentOrderStatusResponse;
import com.uom.lims.api.dto.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * WHY: the order-status read surface for the WhatsApp agent, on the same
 * {@code /api/v1/agent} path and {@code AGENT_READONLY} role as the catalogue — one
 * role, one reviewable list of everything the agent can reach. Unlike the catalogue
 * this endpoint touches a patient-scoped record, which is why it takes the requester's
 * phone and answers only a progress stage, never content. See
 * {@link AgentOrderStatusService} for the possession-check rules.
 */
@RestController
@RequestMapping("/api/v1/agent/orders")
@RequiredArgsConstructor
@PreAuthorize("hasRole('AGENT_READONLY')")
@Tag(name = "Agent Orders", description = "Coarse order progress for the WhatsApp agent")
public class AgentOrderController {

    private final AgentOrderStatusService statusService;

    @Operation(summary = "Order progress for a verified requester",
            description = "Stage only, never results. found=false for unknown order and identity mismatch alike.")
    @GetMapping("/status")
    public ResponseEntity<ApiResponse<AgentOrderStatusResponse>> status(
            @RequestParam("orderNo") String orderNo,
            @RequestParam("phone") String phone) {
        return ResponseEntity.ok(ApiResponse.success(statusService.status(orderNo, phone)));
    }
}
