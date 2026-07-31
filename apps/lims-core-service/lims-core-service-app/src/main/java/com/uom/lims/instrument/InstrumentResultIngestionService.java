package com.uom.lims.instrument;

import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.autoverification.AutoverificationService;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestParameterEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.instrument.astm.AstmMessage;
import com.uom.lims.outbox.OutboxService;
import com.uom.lims.results.ResultFlagResolver;
import com.uom.lims.repository.SampleRepository;
import com.uom.lims.repository.TestParameterRepository;
import com.uom.lims.repository.TestResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Ingests analyzer results into the LIMS. For each specimen it locates the
 * sample by barcode, maps each device result to a test parameter via LOINC,
 * writes/updates the result (idempotently — verified results are never
 * overwritten) and publishes an INSTRUMENT_RESULT_RECEIVED event through the
 * transactional outbox. Results enter as ENTERED, awaiting verification (Phase 4
 * autoverification will decide auto-release vs. hold).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InstrumentResultIngestionService {

    private static final String AUTO_VERIFIER = "AUTO-VERIFY";

    private final SampleRepository sampleRepository;
    private final TestParameterRepository parameterRepository;
    private final TestResultRepository resultRepository;
    private final OutboxService outboxService;
    private final AutoverificationService autoverificationService;
    private final com.uom.lims.notification.CriticalValueNotificationService criticalValueNotificationService;

    @Transactional
    public IngestOutcome ingest(AstmMessage.SpecimenResults specimen, String instrumentId) {
        SampleEntity sample = sampleRepository.findByBarcodeAndDeletedFalse(specimen.sampleId()).orElse(null);
        if (sample == null) {
            log.warn("Instrument {}: no sample for barcode {} — {} result(s) skipped",
                    instrumentId, specimen.sampleId(), specimen.results().size());
            return new IngestOutcome(specimen.sampleId(), 0, specimen.results().size());
        }

        UUID testId = sample.getOrderItem().getTestId();
        int ingested = 0;
        int unmatched = 0;
        boolean allAutoVerified = true;

        // Results are being entered -> move the specimen into testing so the
        // lifecycle is not skipped (no ACCEPTED -> VERIFIED in one hop).
        if (sample.getStatus() == SampleStatus.ACCEPTED) {
            sample.setStatus(SampleStatus.IN_TESTING);
        }

        for (AstmMessage.Result r : specimen.results()) {
            TestParameterEntity parameter = resolveParameter(testId, r.deviceCode());
            if (parameter == null) {
                unmatched++;
                log.warn("Instrument {}: no parameter for device code {} (sample {})",
                        instrumentId, r.deviceCode(), specimen.sampleId());
                continue;
            }

            TestResultEntity result = resultRepository
                    .findBySampleIdAndParameterId(sample.getId(), parameter.getId())
                    .orElseGet(TestResultEntity::new);

            // Never overwrite a result that has already been verified/authorized.
            if (result.getStatus() == ResultStatus.TECHNICALLY_VERIFIED
                    || result.getStatus() == ResultStatus.CLINICALLY_AUTHORIZED) {
                continue;
            }

            BigDecimal numeric = parseNumeric(r.value());
            result.setSample(sample);
            result.setParameter(parameter);
            result.setResultValue(r.value());
            result.setResultNumeric(numeric);
            result.setResultDataType(numeric != null ? "NUMERIC" : "TEXT");

            // Clinical-safety: derive the flag from the parameter's configured
            // critical/reference thresholds and take the more severe of {analyzer
            // flag, threshold flag}. NEVER trust the analyzer flag alone — a missing
            // or unrecognized flag must not let a panic value auto-release.
            ResultFlag analyzerFlag = mapAnalyzerFlag(r.flag());
            boolean analyzerFlagUnrecognized = r.flag() != null && !r.flag().isBlank() && analyzerFlag == null;
            ResultFlag thresholdFlag = ResultFlagResolver.fromThresholds(numeric,
                    parameter.getRefLow(), parameter.getRefHigh(),
                    parameter.getCriticalLow(), parameter.getCriticalHigh());
            ResultFlag finalFlag = ResultFlagResolver.moreSevere(analyzerFlag, thresholdFlag);
            result.setFlag(finalFlag != null ? finalFlag : ResultFlag.NORMAL);
            result.setDraft(false);
            result.setStatus(ResultStatus.ENTERED);

            // Autoverification: auto-release normal numeric results; hold the rest.
            // An unrecognized analyzer flag is held for manual review (fail safe).
            BigDecimal prior = priorNumeric(sample, parameter.getId());
            AutoverificationService.Decision decision = analyzerFlagUnrecognized
                    ? new AutoverificationService.Decision(false,
                            "Unrecognized analyzer flag '" + r.flag() + "' — held for review")
                    : autoverificationService.decide(result, prior);
            if (decision.autoVerify()) {
                result.setStatus(ResultStatus.TECHNICALLY_VERIFIED);
                result.setTechnicallyVerifiedBy(AUTO_VERIFIER);
                result.setTechnicallyVerifiedAt(Instant.now());
            } else {
                allAutoVerified = false;
            }
            // Reassign to the saved instance: BaseEntity's non-null @Version makes Spring
            // Data treat a new row as a merge, so only the RETURNED entity carries the
            // generated id that openForResult needs.
            TestResultEntity savedResult = resultRepository.save(result);
            ingested++;

            // H1: an instrument-ingested critical result opens a critical-value callback
            // (self-guards on critical flag + de-duplicates).
            criticalValueNotificationService.openForResult(savedResult);
        }

        if (ingested > 0 && (sample.getStatus() == SampleStatus.ACCEPTED
                || sample.getStatus() == SampleStatus.IN_TESTING)) {
            // All auto-released -> ready for clinical authorization; otherwise the
            // sample goes to the supervisor's verification queue.
            sample.setStatus(allAutoVerified ? SampleStatus.VERIFIED : SampleStatus.SENT_FOR_VERIFICATION);
            sampleRepository.save(sample);
        }

        if (ingested > 0) {
            outboxService.append("SAMPLE", specimen.sampleId(), "INSTRUMENT_RESULT_RECEIVED",
                    "lab.instrument.results", specimen.sampleId(),
                    new InstrumentResultEvent(specimen.sampleId(), instrumentId, ingested));
        }

        return new IngestOutcome(specimen.sampleId(), ingested, unmatched);
    }

    /** The patient's most recent prior numeric result for this parameter, for delta checks. */
    private BigDecimal priorNumeric(SampleEntity sample, UUID parameterId) {
        String patientId = sample.getOrderItem().getOrder().getPatientId();
        List<TestResultEntity> prior = resultRepository.findPriorNumericResults(
                patientId, parameterId, sample.getId(), org.springframework.data.domain.PageRequest.of(0, 1));
        return prior.isEmpty() ? null : prior.get(0).getResultNumeric();
    }

    private TestParameterEntity resolveParameter(UUID testId, String deviceCode) {
        String loinc = DeviceCodeMap.toLoinc(deviceCode);
        if (loinc == null) {
            return null;
        }
        // Only bind to a parameter that belongs to the ordered test. A cross-test
        // LOINC fallback could file the result under an unrelated test's parameter,
        // so an unmatched analyte is reported as unmatched rather than mis-bound.
        List<TestParameterEntity> scoped = parameterRepository.findByTestIdAndLoincCode(testId, loinc);
        return scoped.isEmpty() ? null : scoped.get(0);
    }

    /** Map an ASTM flag to a ResultFlag; returns null for blank OR unrecognized
     * flags so the caller can fail safe (an unknown flag must not become NORMAL). */
    private static ResultFlag mapAnalyzerFlag(String astmFlag) {
        if (astmFlag == null || astmFlag.isBlank()) {
            return null;
        }
        return switch (astmFlag.trim().toUpperCase()) {
            case "N" -> ResultFlag.NORMAL;
            case "L" -> ResultFlag.LOW;
            case "H" -> ResultFlag.HIGH;
            case "LL", "<" -> ResultFlag.CRITICAL_LOW;
            case "HH", ">" -> ResultFlag.CRITICAL_HIGH;
            default -> null;
        };
    }

    private static BigDecimal parseNumeric(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Outbox payload. */
    public record InstrumentResultEvent(String sampleId, String instrumentId, int resultCount) {
    }

    /** Per-specimen ingestion summary. */
    public record IngestOutcome(String sampleId, int ingested, int unmatched) {
    }
}
