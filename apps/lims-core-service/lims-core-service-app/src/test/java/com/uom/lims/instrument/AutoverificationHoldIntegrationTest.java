package com.uom.lims.instrument;

import com.uom.lims.AbstractIntegrationTest;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestParameterEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.instrument.astm.AstmMessage;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.repository.SampleRepository;
import com.uom.lims.repository.TestResultRepository;
import com.uom.lims.support.ClinicalPathTestFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * E2 — clinical-safety path #3 (auto-verify HOLD on critical). Proves that an
 * instrument-ingested CRITICAL value is HELD (status ENTERED, sample
 * SENT_FOR_VERIFICATION) and never auto-released — it cannot reach reporting without a
 * human — while a normal in-range value auto-releases (the contrast that proves the
 * HOLD is specific to abnormal/critical results).
 */
class AutoverificationHoldIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private InstrumentResultIngestionService ingestionService;
    @Autowired
    private ClinicalPathTestFixtures fixtures;
    @Autowired
    private TestResultRepository testResultRepository;
    @Autowired
    private SampleRepository sampleRepository;

    private TestCatalogEntity catalog;
    private TestParameterEntity plt;

    @BeforeEach
    void seed() {
        fixtures.cleanAll();
        fixtures.branch("B001");
        catalog = fixtures.catalog("FBC-ING", "Full Blood Count", "58410-2");
        // PLT (LOINC 777-3, device code PLT in DeviceCodeMap); critical-low 20, reference 150–400.
        plt = fixtures.parameter(catalog.getId(), "Platelets", "777-3",
                new BigDecimal("150"), new BigDecimal("400"), new BigDecimal("20"), new BigDecimal("1000"));
    }

    @Test
    void criticalResultIsHeldAndBlockedFromReporting() {
        PatientEntity patient = fixtures.patient("P-ING-CRIT", "B001");
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.ACCEPTED, "S-ING-CRIT");

        AstmMessage.SpecimenResults specimen = new AstmMessage.SpecimenResults("S-ING-CRIT",
                List.of(new AstmMessage.Result("PLT", "Platelets", "10", "10*9/L", "L")));

        InstrumentResultIngestionService.IngestOutcome outcome = ingestionService.ingest(specimen, "analyzer-1");
        assertThat(outcome.ingested()).as("result must bind to the parameter, not silently mismatch").isEqualTo(1);

        TestResultEntity result = testResultRepository.findBySampleId(sample.getId()).get(0);
        assertThat(result.getFlag()).isEqualTo(ResultFlag.CRITICAL_LOW);
        assertThat(result.getStatus()).isEqualTo(ResultStatus.ENTERED);
        assertThat(result.getTechnicallyVerifiedBy()).isNotEqualTo("AUTO-VERIFY");

        // Held for a human — never auto-promoted toward authorization/dispatch.
        assertThat(sampleRepository.findById(sample.getId()).orElseThrow().getStatus())
                .isEqualTo(SampleStatus.SENT_FOR_VERIFICATION);
    }

    @Test
    void normalResultIsAutoReleased() {
        PatientEntity patient = fixtures.patient("P-ING-NORM", "B001");
        SampleEntity sample = fixtures.sampleGraph(patient, catalog, SampleStatus.ACCEPTED, "S-ING-NORM");

        AstmMessage.SpecimenResults specimen = new AstmMessage.SpecimenResults("S-ING-NORM",
                List.of(new AstmMessage.Result("PLT", "Platelets", "250", "10*9/L", "N")));

        InstrumentResultIngestionService.IngestOutcome outcome = ingestionService.ingest(specimen, "analyzer-1");
        assertThat(outcome.ingested()).isEqualTo(1);

        TestResultEntity result = testResultRepository.findBySampleId(sample.getId()).get(0);
        assertThat(result.getFlag()).isEqualTo(ResultFlag.NORMAL);
        assertThat(result.getStatus()).isEqualTo(ResultStatus.TECHNICALLY_VERIFIED);
        assertThat(result.getTechnicallyVerifiedBy()).isEqualTo("AUTO-VERIFY");

        assertThat(sampleRepository.findById(sample.getId()).orElseThrow().getStatus())
                .isEqualTo(SampleStatus.VERIFIED);
    }
}
