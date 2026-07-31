package com.uom.lims.support;

import com.uom.lims.api.common.enums.Gender;
import com.uom.lims.api.common.enums.IdentityType;
import com.uom.lims.api.enums.OrderStatus;
import com.uom.lims.api.enums.Priority;
import com.uom.lims.api.enums.ResultFlag;
import com.uom.lims.api.enums.SampleStatus;
import com.uom.lims.api.enums.TubeType;
import com.uom.lims.api.verification.enums.ResultStatus;
import com.uom.lims.entity.BranchEntity;
import com.uom.lims.entity.OrderEntity;
import com.uom.lims.entity.OrderItemEntity;
import com.uom.lims.entity.SampleEntity;
import com.uom.lims.entity.TestCatalogEntity;
import com.uom.lims.entity.TestParameterEntity;
import com.uom.lims.entity.TestResultEntity;
import com.uom.lims.metadata.BranchRepository;
import com.uom.lims.notification.CriticalValueEscalationAttemptRepository;
import com.uom.lims.notification.CriticalValueNotificationRepository;
import com.uom.lims.patient.PatientEntity;
import com.uom.lims.patient.PatientRepository;
import com.uom.lims.repository.OrderItemRepository;
import com.uom.lims.repository.OrderRepository;
import com.uom.lims.repository.SampleRepository;
import com.uom.lims.repository.TestCatalogRepository;
import com.uom.lims.repository.TestParameterRepository;
import com.uom.lims.repository.TestResultAmendmentRepository;
import com.uom.lims.repository.TestResultRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Seeds the full clinical graph (Branch / Patient / Catalog / Parameter / Order /
 * OrderItem / Sample / TestResult) for DB-backed integration tests, setting every
 * NOT-NULL column the validate-mode schema requires. Shared by the H1 (critical
 * value), H2 (amendment) and E2 (verification / authorization / auto-verify) tests so
 * each test only states the state it cares about.
 *
 * <p>Registered as a test {@code @Component} so it is component-scanned into the
 * integration-test context and can be {@code @Autowired}.
 */
@Component
public class ClinicalPathTestFixtures {

    private static final AtomicLong SEQ = new AtomicLong(1);

    private final BranchRepository branchRepository;
    private final PatientRepository patientRepository;
    private final TestCatalogRepository testCatalogRepository;
    private final TestParameterRepository testParameterRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final SampleRepository sampleRepository;
    private final TestResultRepository testResultRepository;
    private final TestResultAmendmentRepository amendmentRepository;
    private final CriticalValueNotificationRepository criticalNotificationRepository;
    private final CriticalValueEscalationAttemptRepository escalationAttemptRepository;

    public ClinicalPathTestFixtures(BranchRepository branchRepository,
                                    PatientRepository patientRepository,
                                    TestCatalogRepository testCatalogRepository,
                                    TestParameterRepository testParameterRepository,
                                    OrderRepository orderRepository,
                                    OrderItemRepository orderItemRepository,
                                    SampleRepository sampleRepository,
                                    TestResultRepository testResultRepository,
                                    TestResultAmendmentRepository amendmentRepository,
                                    CriticalValueNotificationRepository criticalNotificationRepository,
                                    CriticalValueEscalationAttemptRepository escalationAttemptRepository) {
        this.branchRepository = branchRepository;
        this.patientRepository = patientRepository;
        this.testCatalogRepository = testCatalogRepository;
        this.testParameterRepository = testParameterRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.sampleRepository = sampleRepository;
        this.testResultRepository = testResultRepository;
        this.amendmentRepository = amendmentRepository;
        this.criticalNotificationRepository = criticalNotificationRepository;
        this.escalationAttemptRepository = escalationAttemptRepository;
    }

    /** Deletes seeded data in child→parent FK order. Never touches audit_log (append-only, H3). */
    public void cleanAll() {
        escalationAttemptRepository.deleteAll();
        criticalNotificationRepository.deleteAll();
        amendmentRepository.deleteAll();
        testResultRepository.deleteAll();
        sampleRepository.deleteAll();
        orderItemRepository.deleteAll();
        orderRepository.deleteAll();
        testParameterRepository.deleteAll();
        testCatalogRepository.deleteAll();
        patientRepository.deleteAll();
        branchRepository.deleteAll();
    }

    public BranchEntity branch(String code) {
        BranchEntity branch = new BranchEntity();
        branch.setCode(code);
        branch.setName("Branch " + code);
        branch.setCreatedBy("test-seed");
        return branchRepository.save(branch);
    }

    public PatientEntity patient(String patientCode, String branchCode) {
        long n = SEQ.getAndIncrement();
        PatientEntity patient = new PatientEntity();
        patient.setPatientCode(patientCode);
        patient.setFullName("Test Patient " + patientCode);
        patient.setDob(LocalDate.of(1985, 5, 20));
        patient.setGender(Gender.MALE);
        patient.setIdentityType(IdentityType.NIC);
        patient.setIdentityNumber(String.format("%09dV", n));
        patient.setPhone(String.format("+9477%07d", n));
        patient.setAddress("1 Test Road, Colombo");
        patient.setBranchCode(branchCode);
        patient.setCreatedBy("test-seed");
        return patientRepository.save(patient);
    }

    public TestCatalogEntity catalog(String testCode, String testName, String loinc) {
        TestCatalogEntity catalog = new TestCatalogEntity();
        catalog.setTestCode(testCode);
        catalog.setTestName(testName);
        catalog.setLoincCode(loinc);
        catalog.setCategory("HEMATOLOGY");
        catalog.setPrice(new BigDecimal("1500.00"));
        catalog.setSampleType("BLOOD");
        catalog.setTubeType(TubeType.EDTA_PURPLE);
        catalog.setActive(true);
        catalog.setCreatedBy("test-seed");
        return testCatalogRepository.save(catalog);
    }

    public TestParameterEntity parameter(java.util.UUID testId, String name, String loinc,
                                         BigDecimal refLow, BigDecimal refHigh,
                                         BigDecimal criticalLow, BigDecimal criticalHigh) {
        TestParameterEntity parameter = new TestParameterEntity();
        parameter.setTestId(testId);
        parameter.setName(name);
        parameter.setLoincCode(loinc);
        parameter.setRefLow(refLow);
        parameter.setRefHigh(refHigh);
        parameter.setCriticalLow(criticalLow);
        parameter.setCriticalHigh(criticalHigh);
        parameter.setDisplayOrder(1);
        parameter.setCreatedBy("test-seed");
        return testParameterRepository.save(parameter);
    }

    /** Creates Order → OrderItem → Sample for the given patient/catalog, sample in the given status. */
    public SampleEntity sampleGraph(PatientEntity patient, TestCatalogEntity catalog,
                                    SampleStatus sampleStatus, String barcode) {
        long n = SEQ.getAndIncrement();

        OrderEntity order = new OrderEntity();
        order.setOrderNo("ORD-" + n);
        order.setPatientId(patient.getPatientCode());
        order.setBranchCode(patient.getBranchCode());
        order.setStatus(OrderStatus.IN_PROGRESS);
        order.setPriority(Priority.NORMAL);
        order.setCreatedBy("test-seed");
        order = orderRepository.save(order);

        OrderItemEntity item = new OrderItemEntity();
        item.setOrder(order);
        item.setTestId(catalog.getId());
        item.setPrice(catalog.getPrice());
        item.setStatus(SampleStatus.ACCEPTED);
        item.setCreatedBy("test-seed");
        item = orderItemRepository.save(item);

        SampleEntity sample = new SampleEntity();
        sample.setOrderItem(item);
        sample.setBarcode(barcode);
        sample.setTubeType(TubeType.EDTA_PURPLE);
        sample.setStatus(sampleStatus);
        sample.setPriority(Priority.NORMAL);
        sample.setRecollectionCount(0);
        sample.setCreatedBy("test-seed");
        return sampleRepository.save(sample);
    }

    public TestResultEntity result(SampleEntity sample, TestParameterEntity parameter,
                                   ResultFlag flag, ResultStatus status, BigDecimal numeric,
                                   String value, boolean draft) {
        TestResultEntity result = new TestResultEntity();
        result.setSample(sample);
        result.setParameter(parameter);
        result.setResultValue(value);
        result.setResultNumeric(numeric);
        result.setResultDataType(numeric != null ? "NUMERIC" : "TEXT");
        result.setFlag(flag);
        result.setStatus(status);
        result.setDraft(draft);
        result.setVersionNo(1);
        result.setAmended(false);
        result.setCreatedBy("test-seed");
        return testResultRepository.save(result);
    }
}
