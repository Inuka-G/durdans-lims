package com.uom.lims.service;

import com.uom.lims.entity.SampleEntity;
import com.uom.lims.repository.SampleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Year;

/**
 * Issues the human-readable case number a result is known by on every screen,
 * report and audit export: {@code RES<year>-<5-digit sequence>}, the same shape
 * as the patient code ({@code PAT2026-00001}).
 *
 * <p>One number per specimen (case), not per analyte row: a Full Blood Count is
 * one result to the supervisor, the pathologist and the patient, however many
 * parameters it carries. The number is issued the first time a specimen carries
 * a submitted (non-draft) value and never changes afterwards — re-entry after a
 * return, instrument re-ingestion and amendments all keep it.
 *
 * <p>The sequence is a Postgres sequence, so concurrent submissions from several
 * benches cannot collide, and a number is never reused even if the transaction
 * that drew it rolls back (a gap is harmless; a duplicate is not).
 */
@Service
@RequiredArgsConstructor
public class ResultNumberService {

    private static final String PREFIX = "RES";

    private final SampleRepository sampleRepository;

    /**
     * Assigns a case number to the sample if it does not have one yet. The caller
     * owns the transaction and the save; this only mutates the managed entity.
     *
     * @return the sample's case number (existing or newly issued)
     */
    public String ensureResultNo(SampleEntity sample) {
        String existing = sample.getResultNo();
        if (existing != null && !existing.isBlank()) {
            return existing;
        }
        long sequence = sampleRepository.getNextResultSequence();
        String resultNo = format(Year.now().getValue(), sequence);
        sample.setResultNo(resultNo);
        return resultNo;
    }

    /** {@code RES2026-00042}. Widens past five digits rather than wrapping. */
    static String format(int year, long sequence) {
        return PREFIX + year + "-" + String.format("%05d", sequence);
    }
}
