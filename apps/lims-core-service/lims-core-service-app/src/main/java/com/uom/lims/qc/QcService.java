package com.uom.lims.qc;

import com.uom.lims.api.dto.response.QcDashboardResponse;
import com.uom.lims.api.dto.response.QcRunItemResponse;
import com.uom.lims.security.SecurityUtils;
import com.uom.lims.service.LabOperationsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Records internal-QC runs, evaluating each against the Westgard multirules, and
 * serves the QC dashboard from persisted data (falling back to the static seed
 * only when no real QC has been recorded yet).
 */
@Service
@RequiredArgsConstructor
public class QcService {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("hh:mm a")
            .withZone(ZoneId.systemDefault());
    private static final int SERIES_WINDOW = 30;

    private final QcResultRepository repository;
    private final LabOperationsService labOperationsService;

    public record RecordQcRunRequest(String instrument, String analyte, String controlLevel, String controlLot,
                                     BigDecimal measuredValue, BigDecimal mean, BigDecimal sd) {
    }

    public record QcRunOutcome(String id, String status, List<String> violations) {
    }

    @Transactional
    public QcRunOutcome record(RecordQcRunRequest req) {
        if (req.measuredValue() == null || req.mean() == null
                || req.sd() == null || req.sd().signum() <= 0) {
            throw new com.uom.lims.exception.BusinessValidationException(
                    "measuredValue, mean and a positive sd are required");
        }
        double value = req.measuredValue().doubleValue();
        double mean = req.mean().doubleValue();
        double sd = req.sd().doubleValue();

        // Oldest-first history for the same control series.
        List<QcResultEntity> recent = repository
                .findByInstrumentAndAnalyteAndControlLevelOrderByPerformedAtDesc(
                        req.instrument(), req.analyte(), req.controlLevel(), PageRequest.of(0, SERIES_WINDOW));
        List<Double> history = new ArrayList<>();
        for (int i = recent.size() - 1; i >= 0; i--) {
            history.add(recent.get(i).getMeasuredValue().doubleValue());
        }

        WestgardEvaluator.Evaluation eval = WestgardEvaluator.evaluate(value, mean, sd, history);
        String status = eval.rejected() ? "FAIL" : (eval.violations().contains("1-2s") ? "WARN" : "PASS");

        QcResultEntity entity = new QcResultEntity();
        entity.setInstrument(req.instrument());
        entity.setAnalyte(req.analyte());
        entity.setControlLevel(req.controlLevel());
        entity.setControlLot(req.controlLot());
        entity.setMeasuredValue(req.measuredValue());
        entity.setMean(req.mean());
        entity.setSd(req.sd());
        entity.setZScore(BigDecimal.valueOf((value - mean) / sd).setScale(3, RoundingMode.HALF_UP));
        entity.setStatus(status);
        entity.setViolations(String.join(",", eval.violations()));
        entity.setPerformedBy(SecurityUtils.getCurrentUsername());
        entity.setBranchCode(SecurityUtils.getCurrentBranchId());
        repository.save(entity);

        return new QcRunOutcome(entity.getId().toString(), status, eval.violations());
    }

    @Transactional(readOnly = true)
    public QcDashboardResponse getDashboard() {
        List<QcResultEntity> recent = repository.findByOrderByPerformedAtDesc(PageRequest.of(0, 50));
        if (recent.isEmpty()) {
            // No real QC yet — keep the seeded demo dashboard.
            return labOperationsService.getQcDashboard();
        }
        List<QcRunItemResponse> runs = recent.stream().map(QcService::toRun).toList();
        int passed = (int) runs.stream().filter(r -> "PASS".equals(r.status())).count();
        int warnings = (int) runs.stream().filter(r -> "WARN".equals(r.status())).count();
        int failures = (int) runs.stream().filter(r -> "FAIL".equals(r.status())).count();
        return new QcDashboardResponse(runs.size(), passed, warnings, failures, runs);
    }

    private static QcRunItemResponse toRun(QcResultEntity e) {
        return new QcRunItemResponse(
                e.getId().toString(), e.getInstrument(), e.getAnalyte(), e.getControlLevel(),
                e.getMeasuredValue().toPlainString(), e.getMean().toPlainString(), e.getSd().toPlainString(),
                e.getStatus(), e.getPerformedBy(), TIME.format(e.getPerformedAt()));
    }
}
