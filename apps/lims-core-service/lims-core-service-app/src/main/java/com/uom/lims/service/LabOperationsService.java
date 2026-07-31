package com.uom.lims.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uom.lims.api.dto.response.InstrumentStatusResponse;
import com.uom.lims.api.dto.response.QcDashboardResponse;
import com.uom.lims.api.dto.response.QcRunItemResponse;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class LabOperationsService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("hh:mm a")
            .withZone(ZoneId.systemDefault());

    private final ObjectMapper objectMapper;

    public LabOperationsService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public QcDashboardResponse getQcDashboard() {
        List<QcRunItemResponse> runs = loadQcRuns();

        int passed = (int) runs.stream().filter(run -> "PASS".equals(run.status())).count();
        int warnings = (int) runs.stream().filter(run -> "WARN".equals(run.status())).count();
        int failures = (int) runs.stream().filter(run -> "FAIL".equals(run.status())).count();

        return new QcDashboardResponse(
                runs.size(),
                passed,
                warnings,
                failures,
                runs);
    }

    public List<InstrumentStatusResponse> getInstruments() {
        return loadReferenceData("reference-data/instruments.json", new TypeReference<>() {});
    }

    public InstrumentStatusResponse syncInstrument(String instrumentId) {
        return getInstruments().stream()
                .filter(instrument -> instrument.id().equals(instrumentId))
                .findFirst()
                .map(instrument -> new InstrumentStatusResponse(
                        instrument.id(),
                        instrument.name(),
                        instrument.type(),
                        instrument.model(),
                        instrument.serial(),
                        instrument.status(),
                        "Just now",
                        instrument.testsToday(),
                        instrument.location(),
                        instrument.qcStatus()))
                .orElseThrow(() -> new IllegalArgumentException("Instrument not found: " + instrumentId));
    }

    private List<QcRunItemResponse> loadQcRuns() {
        Instant now = Instant.now();
        List<QcRunSeed> seeds = loadReferenceData("reference-data/qc-runs.json", new TypeReference<>() {});

        return seeds.stream()
                .map(seed -> new QcRunItemResponse(
                        seed.id(),
                        seed.instrument(),
                        seed.testGroup(),
                        seed.level(),
                        seed.result(),
                        seed.expected(),
                        seed.sd(),
                        seed.status(),
                        seed.performedBy(),
                        TIME_FORMATTER.format(now.minusSeconds(seed.minutesAgo() * 60L))))
                .toList();
    }

    private <T> List<T> loadReferenceData(String path, TypeReference<List<T>> typeReference) {
        try {
            return objectMapper.readValue(new ClassPathResource(path).getInputStream(), typeReference);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to load reference data from " + path, exception);
        }
    }

    private record QcRunSeed(
            String id,
            String instrument,
            String testGroup,
            String level,
            String result,
            String expected,
            String sd,
            String status,
            String performedBy,
            int minutesAgo) {
    }
}
