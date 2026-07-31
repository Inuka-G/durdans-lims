package com.uom.lims.controller;

import com.uom.lims.api.dto.response.InstrumentStatusResponse;
import com.uom.lims.api.dto.response.QcDashboardResponse;
import com.uom.lims.qc.QcService;
import com.uom.lims.service.LabOperationsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/mlt")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('MLT','LAB_SUPERVISOR','BRANCH_ADMIN','SUPER_ADMIN')")
public class MltOperationsController {

    private final LabOperationsService labOperationsService;
    private final QcService qcService;

    @GetMapping("/qc-dashboard")
    public ResponseEntity<QcDashboardResponse> getQcDashboard() {
        // Real persisted QC (Westgard-evaluated), falling back to the seed if empty.
        return ResponseEntity.ok(qcService.getDashboard());
    }

    @PostMapping("/qc-runs")
    public ResponseEntity<QcService.QcRunOutcome> recordQcRun(
            @RequestBody QcService.RecordQcRunRequest request) {
        return ResponseEntity.ok(qcService.record(request));
    }

    @GetMapping("/instruments")
    public ResponseEntity<List<InstrumentStatusResponse>> getInstruments() {
        return ResponseEntity.ok(labOperationsService.getInstruments());
    }

    @PostMapping("/instruments/{id}/sync")
    public ResponseEntity<InstrumentStatusResponse> syncInstrument(@PathVariable String id) {
        return ResponseEntity.ok(labOperationsService.syncInstrument(id));
    }
}
