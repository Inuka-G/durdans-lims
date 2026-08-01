package com.uom.lims.controller;

import com.uom.lims.api.dto.response.InstrumentOptionResponse;
import com.uom.lims.api.dto.response.QcAnalyteOptionResponse;
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
    private final com.uom.lims.instrument.InstrumentRepository instrumentRepository;
    private final com.uom.lims.repository.TestParameterRepository testParameterRepository;

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

    /**
     * The instruments a user may select when recording QC or entering results.
     *
     * <p>Served from the registry table rather than reference-data/instruments.json,
     * because the QC release gate joins on these codes: an option that is not in
     * the registry would produce results the gate can never clear.
     */
    @GetMapping("/instrument-registry")
    public ResponseEntity<List<InstrumentOptionResponse>> getInstrumentRegistry() {
        return ResponseEntity.ok(instrumentRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(i -> new InstrumentOptionResponse(
                        i.getCode(), i.getName(), i.getInstrumentType(), i.isQcRequired()))
                .toList());
    }

    /** Analytes that can be controlled, so the QC form offers codes instead of asking for them. */
    @GetMapping("/qc-analytes")
    public ResponseEntity<List<QcAnalyteOptionResponse>> getQcAnalytes() {
        return ResponseEntity.ok(testParameterRepository.findControllableAnalytes().stream()
                .map(row -> new QcAnalyteOptionResponse((String) row[0], (String) row[1]))
                .distinct()
                .toList());
    }
}
