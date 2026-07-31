package com.uom.lims.controller;

import com.uom.lims.api.critical.dto.request.AcknowledgeCriticalRequest;
import com.uom.lims.api.critical.dto.response.CriticalNotificationResponse;
import com.uom.lims.notification.CriticalValueNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Critical-value (panic) callback endpoints (H1): list open callbacks for the lab and
 * acknowledge one with a read-back. Branch-scoped via {@link CriticalValueNotificationService}.
 */
@RestController
@RequestMapping("/api/v1/critical-values")
@RequiredArgsConstructor
public class CriticalValueController {

    private final CriticalValueNotificationService criticalValueNotificationService;

    @PreAuthorize("hasAnyRole('MLT','LAB_SUPERVISOR','PATHOLOGIST','LAB_RECEPTIONIST','LAB_RECEPTION','BRANCH_ADMIN','SUPER_ADMIN')")
    @GetMapping
    public List<CriticalNotificationResponse> open(@RequestParam(defaultValue = "100") int limit) {
        return criticalValueNotificationService.listOpen(limit);
    }

    @PreAuthorize("hasAnyRole('MLT','LAB_SUPERVISOR','PATHOLOGIST','BRANCH_ADMIN','SUPER_ADMIN')")
    @PostMapping("/{id}/acknowledge")
    public CriticalNotificationResponse acknowledge(@PathVariable UUID id,
                                                    @RequestBody AcknowledgeCriticalRequest request) {
        return criticalValueNotificationService.acknowledge(id, request);
    }
}
