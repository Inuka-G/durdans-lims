import type {
    SampleStatus, Sample, AccessioningLogEntry, QCRun, Instrument, TestResult,
    BarcodeSearchResult, PendingVerificationSample, InstrumentBatch,
    ValidationSample, DispatchReport, DeliveryRecord, FailedDelivery
} from '@/types/sample-lifecycle';

// ==========================================
// STATUS LABELS
// ==========================================
// No colour lookup maps live here any more:
//   • status / priority / flag / QC / instrument chips are rendered by
//     `components/ui/StatusChip` (`STATUS_TONE` + semantic tokens, dark-mode
//     aware), which replaced PRIORITY_COLORS, SAMPLE_STATUS_COLORS,
//     FLAG_COLORS, INSTRUMENT_STATUS_CONFIG and QC_STATUS_CONFIG;
//   • tube cap colours are supplies-inventory data, not a static map — each
//     sample / label payload carries `tubeColor` from the tube-keyed supplies
//     inventory and is resolved via `getTubeHexColor`
//     (`lib/phlebotomy-label-print.ts`), rendered by `shared/TubeIndicator`.

export function formatStatusLabel(s: SampleStatus | string): string {
    return s.replace(/_/g, ' ');
}

// ==========================================
// MOCK DATA – PHLEBOTOMY
// ==========================================

export const MOCK_PHLEBOTOMY_STATS = { pendingCollections: 12, urgentSamples: 3, collectedToday: 47, rejections: 2 };

export const MOCK_PHLEBOTOMY_WORKLIST: Sample[] = [
    { id: 's1', sampleId: 'S-90231', orderId: 'ORD-55210', patient: { id: 'p1', pid: 'DH-40281', name: 'Mohamed Shafi', age: 58, gender: 'M', wardRoom: 'Ward 3B — Bed 12' }, testType: 'FBC + CRP + ESR', testCodes: ['FBC', 'CRP', 'ESR'], priority: 'URGENT', status: 'PENDING_COLLECTION', tubeTypes: ['EDTA_PURPLE', 'SST_GOLD'], waitTimeMinutes: 25 },
    { id: 's2', sampleId: 'S-90232', orderId: 'ORD-55211', patient: { id: 'p2', pid: 'DH-40392', name: 'Kumari Jayawardena', age: 42, gender: 'F' }, testType: 'Lipid Profile + HbA1c', testCodes: ['Lipid', 'HbA1c'], priority: 'NORMAL', status: 'PENDING_COLLECTION', tubeTypes: ['SST_GOLD', 'EDTA_LAVENDER'], waitTimeMinutes: 45 },
    { id: 's3', sampleId: 'S-90233', orderId: 'ORD-55212', patient: { id: 'p3', pid: 'DH-40102', name: 'Nimal Perera', age: 64, gender: 'M', wardRoom: 'ICU — Bed 4' }, testType: 'Troponin I + UAE', testCodes: ['Troponin I', 'UAE'], priority: 'STAT', status: 'PENDING_COLLECTION', tubeTypes: ['EDTA_PURPLE', 'HEPARIN_GREEN'], waitTimeMinutes: 8 },
    { id: 's4', sampleId: 'S-90234', orderId: 'ORD-55213', patient: { id: 'p4', pid: 'DH-39801', name: 'Sandya Fernando', age: 35, gender: 'F' }, testType: 'Thyroid Panel (T3/T4/TSH)', testCodes: ['T3', 'T4', 'TSH'], priority: 'NORMAL', status: 'PENDING_COLLECTION', tubeTypes: ['SST_GOLD'], waitTimeMinutes: 60 },
    { id: 's5', sampleId: 'S-90235', orderId: 'ORD-55214', patient: { id: 'p5', pid: 'DH-39021', name: 'Ruwan Jayawardena', age: 71, gender: 'M', wardRoom: 'Ward 5A — Bed 8' }, testType: 'Blood Culture', testCodes: ['Blood Culture'], priority: 'STAT', status: 'PENDING_COLLECTION', tubeTypes: ['HEPARIN_GREEN'], waitTimeMinutes: 12 },
    { id: 's6', sampleId: 'S-90236', orderId: 'ORD-55215', patient: { id: 'p6', pid: 'DH-41091', name: 'Dilini Wickremasinghe', age: 28, gender: 'F' }, testType: 'Urine Culture', testCodes: ['Urine Culture'], priority: 'NORMAL', status: 'PENDING_COLLECTION', tubeTypes: ['URINE_YELLOW'], waitTimeMinutes: 35 },
];

// ==========================================
// MOCK DATA – RECEPTION
// ==========================================

export const MOCK_RECEPTION_STATS = { samplesPending: 18, urgentSamples: 4, acceptedToday: 62, rejectionRate: '3.2%' };

export const MOCK_RECEPTION_SAMPLES: Sample[] = [
    { id: 'r1', sampleId: 'S-90231', orderId: 'ORD-55210', patient: { id: 'p1', pid: 'DH-40281', name: 'Jane Doe', age: 58, gender: 'F' }, testType: 'HbA1c + Lipid Profile', testCodes: ['HbA1c', 'Lipid'], priority: 'NORMAL', status: 'RECEIVED_AT_LAB', tubeTypes: ['SST_GOLD', 'EDTA_LAVENDER'], collectionTime: '08:30 AM', receivedTime: '09:15 AM' },
    { id: 'r2', sampleId: 'S-90232', orderId: 'ORD-55211', patient: { id: 'p2', pid: 'DH-40392', name: 'Kumari J.', age: 42, gender: 'F' }, testType: 'Full Blood Count', testCodes: ['FBC'], priority: 'URGENT', status: 'RECEIVED_AT_LAB', tubeTypes: ['EDTA_PURPLE'], collectionTime: '08:45 AM', receivedTime: '09:20 AM' },
    { id: 'r3', sampleId: 'S-90233', orderId: 'ORD-55212', patient: { id: 'p3', pid: 'DH-40102', name: 'Nimal Perera', age: 64, gender: 'M' }, testType: 'Thyroid Panel', testCodes: ['T3', 'T4', 'TSH'], priority: 'NORMAL', status: 'QUALITY_CHECK', tubeTypes: ['SST_GOLD'], collectionTime: '09:00 AM', receivedTime: '09:35 AM' },
    { id: 'r4', sampleId: 'S-90234', orderId: 'ORD-55213', patient: { id: 'p4', pid: 'DH-39801', name: 'Sandya F.', age: 35, gender: 'F' }, testType: 'Urine Culture', testCodes: ['Urine Culture'], priority: 'STAT', status: 'RECEIVED_AT_LAB', tubeTypes: ['URINE_YELLOW'], collectionTime: '09:15 AM', receivedTime: '09:45 AM' },
    { id: 'r5', sampleId: 'S-90235', orderId: 'ORD-55214', patient: { id: 'p5', pid: 'DH-41002', name: 'Aruna De Silva', age: 50, gender: 'M' }, testType: 'Serum Electrolytes', testCodes: ['Na', 'K', 'Cl'], priority: 'URGENT', status: 'RECEIVED_AT_LAB', tubeTypes: ['HEPARIN_GREEN'], collectionTime: '09:30 AM', receivedTime: '10:00 AM' },
];

export const MOCK_ACCESSION_LOGS: AccessioningLogEntry[] = [
    { id: 'al1', sampleId: 'S-90231', patientName: 'Jane Doe', pid: 'DH-40281', testType: 'HbA1c + Lipid Profile', priority: 'NORMAL', action: 'VERIFIED', status: 'ACCEPTED', performedBy: 'Lab Tech Silva', timestamp: '10:30 AM', notes: '' },
    { id: 'al2', sampleId: 'S-90199', patientName: 'Ravi K.', pid: 'DH-40012', testType: 'Full Blood Count', priority: 'URGENT', action: 'REJECTED', status: 'REJECTED', performedBy: 'Lab Tech Silva', timestamp: '10:35 AM', notes: 'Hemolyzed sample — recollection requested' },
    { id: 'al3', sampleId: 'S-90228', patientName: 'Kumari J.', pid: 'DH-40392', testType: 'Lipid Profile', priority: 'NORMAL', action: 'VERIFIED', status: 'ACCEPTED', performedBy: 'Lab Tech Perera', timestamp: '10:42 AM', notes: '' },
    { id: 'al4', sampleId: 'S-90215', patientName: 'Aruna De Silva', pid: 'DH-41002', testType: 'Thyroid Panel', priority: 'URGENT', action: 'VERIFIED', status: 'ACCEPTED', performedBy: 'Lab Tech Perera', timestamp: '10:52 AM', notes: '' },
    { id: 'al5', sampleId: 'S-90199', patientName: 'Saman Perera', pid: 'DH-40531', testType: 'Urine Culture', priority: 'NORMAL', action: 'REJECTED', status: 'REJECTED', performedBy: 'Lab Tech Silva', timestamp: '10:55 AM', notes: 'Contaminated container' },
    { id: 'al6', sampleId: 'S-90241', patientName: 'Chaminda F.', pid: 'DH-39021', testType: 'Blood Culture', priority: 'URGENT', action: 'VERIFIED', status: 'ACCEPTED', performedBy: 'Lab Tech Perera', timestamp: '11:05 AM', notes: 'STAT — ICU patient' },
];

export const MOCK_BARCODE_RESULT: BarcodeSearchResult = {
    sampleId: 'S-90231', patientName: 'Jane Doe', pid: 'DH-40281',
    testType: 'HbA1c + Lipid Profile', testCodes: ['HbA1c', 'Lipid Profile'],
    collectedAt: '08:30 AM', collectedBy: 'Dr. Aritha Perera',
    tubeType: 'SST Gold', tubeColorClass: 'bg-yellow-400',
    accessionedAt: '09:15 AM', labNo: 'LAB-2023-04521',
};

// ==========================================
// MOCK DATA – MLT TESTING
// ==========================================

export const MOCK_MLT_STATS = { pendingTests: 24, rejectedTests: 3, rejectedSince: '08:00 AM', pendingSince: '07:00 AM', criticalResults: 2, myDrafts: 5 };

export const MOCK_MLT_WORKLIST: Sample[] = [
    { id: 'm1', sampleId: 'S-90231', orderId: 'ORD-55210', patient: { id: 'p1', pid: 'DH-40281', name: 'Mohamed Shafi', age: 58, gender: 'M' }, testType: 'Full Blood Count', testCodes: ['FBC'], priority: 'URGENT', status: 'IN_TESTING', tubeTypes: ['EDTA_PURPLE'], department: 'Haematology' },
    { id: 'm2', sampleId: 'S-90232', orderId: 'ORD-55211', patient: { id: 'p2', pid: 'DH-40392', name: 'Kumari J.', age: 42, gender: 'F' }, testType: 'Lipid Profile', testCodes: ['Lipid'], priority: 'NORMAL', status: 'ACCEPTED', tubeTypes: ['SST_GOLD'], department: 'Biochemistry' },
    { id: 'm3', sampleId: 'S-90233', orderId: 'ORD-55212', patient: { id: 'p3', pid: 'DH-40102', name: 'Nimal Perera', age: 64, gender: 'M' }, testType: 'Thyroid Panel', testCodes: ['T3', 'T4', 'TSH'], priority: 'NORMAL', status: 'ACCEPTED', tubeTypes: ['SST_GOLD'], department: 'Immunology' },
    { id: 'm4', sampleId: 'S-90234', orderId: 'ORD-55213', patient: { id: 'p4', pid: 'DH-39801', name: 'Sandya Fernando', age: 35, gender: 'F' }, testType: 'HbA1c', testCodes: ['HbA1c'], priority: 'NORMAL', status: 'IN_TESTING', tubeTypes: ['EDTA_LAVENDER'], department: 'Biochemistry' },
    { id: 'm5', sampleId: 'S-90235', orderId: 'ORD-55214', patient: { id: 'p5', pid: 'DH-39021', name: 'Ruwan J.', age: 71, gender: 'M' }, testType: 'Blood Culture', testCodes: ['Blood Culture'], priority: 'STAT', status: 'ACCEPTED', tubeTypes: ['HEPARIN_GREEN'], department: 'Microbiology' },
];

export const MOCK_MLT_ALL_WORKLIST: Sample[] = [
    ...MOCK_MLT_WORKLIST,
    { id: 'm6', sampleId: 'S-90236', orderId: 'ORD-55215', patient: { id: 'p6', pid: 'DH-41091', name: 'Dilini W.', age: 28, gender: 'F' }, testType: 'Urine Culture', testCodes: ['Urine Culture'], priority: 'NORMAL', status: 'RESULT_ENTERED', tubeTypes: ['URINE_YELLOW'], department: 'Microbiology' },
    { id: 'm7', sampleId: 'S-90237', orderId: 'ORD-55216', patient: { id: 'p7', pid: 'DH-38001', name: 'Chaminda F.', age: 45, gender: 'M' }, testType: 'Serum Electrolytes', testCodes: ['Na', 'K', 'Cl'], priority: 'URGENT', status: 'SENT_FOR_VERIFICATION', tubeTypes: ['HEPARIN_GREEN'], department: 'Biochemistry' },
];

export const MOCK_RESULT_ENTRY: { sample: Sample; results: TestResult[] } = {
    sample: { id: 'm1', sampleId: 'S-90231', orderId: 'ORD-55210', patient: { id: 'p1', pid: 'DH-40281', name: 'Mohamed Shafi', age: 58, gender: 'M' }, testType: 'Full Blood Count', testCodes: ['FBC'], priority: 'URGENT', status: 'IN_TESTING', tubeTypes: ['EDTA_PURPLE'], department: 'Haematology' },
    results: [
        { parameterId: 'r1', parameterName: 'WBC', result: 12.5, unit: '×10⁹/L', referenceRangeLow: 4.0, referenceRangeHigh: 11.0, flag: 'HIGH', isCritical: false },
        { parameterId: 'r2', parameterName: 'RBC', result: 4.8, unit: '×10¹²/L', referenceRangeLow: 4.5, referenceRangeHigh: 5.5, flag: 'NORMAL', isCritical: false },
        { parameterId: 'r3', parameterName: 'Hemoglobin', result: 13.2, unit: 'g/dL', referenceRangeLow: 13.0, referenceRangeHigh: 17.0, flag: 'NORMAL', isCritical: false },
        { parameterId: 'r4', parameterName: 'Hematocrit', result: 40.1, unit: '%', referenceRangeLow: 38.0, referenceRangeHigh: 50.0, flag: 'NORMAL', isCritical: false },
        { parameterId: 'r5', parameterName: 'Platelets', result: 45, unit: '×10⁹/L', referenceRangeLow: 150, referenceRangeHigh: 400, flag: 'CRITICAL_LOW', isCritical: true },
        { parameterId: 'r6', parameterName: 'MCV', result: 88.2, unit: 'fL', referenceRangeLow: 80, referenceRangeHigh: 100, flag: 'NORMAL', isCritical: false },
        { parameterId: 'r7', parameterName: 'MCH', result: 29.1, unit: 'pg', referenceRangeLow: 27, referenceRangeHigh: 33, flag: 'NORMAL', isCritical: false },
        { parameterId: 'r8', parameterName: 'Neutrophils', result: 78, unit: '%', referenceRangeLow: 40, referenceRangeHigh: 70, flag: 'HIGH', isCritical: false },
    ],
};

export const MOCK_QC_RUNS: QCRun[] = [
    { id: 'qc1', instrument: 'Sysmex XN-1000', testGroup: 'Full Blood Count', level: 'Normal', result: '5.2', expected: '5.0 ± 0.3', sd: '0.7 SD', status: 'PASS', performedBy: 'MLT Aritha', timestamp: '07:30 AM' },
    { id: 'qc2', instrument: 'Sysmex XN-1000', testGroup: 'Full Blood Count', level: 'Low', result: '2.1', expected: '2.0 ± 0.2', sd: '0.5 SD', status: 'PASS', performedBy: 'MLT Aritha', timestamp: '07:32 AM' },
    { id: 'qc3', instrument: 'Cobas c501', testGroup: 'Lipid Panel', level: 'Normal', result: '198', expected: '200 ± 8', sd: '-0.25 SD', status: 'PASS', performedBy: 'MLT Silva', timestamp: '07:45 AM' },
    { id: 'qc4', instrument: 'Cobas c501', testGroup: 'HbA1c', level: 'High', result: '9.8', expected: '8.5 ± 0.4', sd: '3.25 SD', status: 'FAIL', performedBy: 'MLT Silva', timestamp: '07:48 AM' },
    { id: 'qc5', instrument: 'Cobas e411', testGroup: 'Thyroid Panel', level: 'Normal', result: '4.1', expected: '4.0 ± 0.5', sd: '0.2 SD', status: 'PASS', performedBy: 'MLT Perera', timestamp: '08:00 AM' },
    { id: 'qc6', instrument: 'Cobas e411', testGroup: 'Cortisol', level: 'Low', result: '3.8', expected: '5.0 ± 0.8', sd: '-1.5 SD', status: 'WARN', performedBy: 'MLT Perera', timestamp: '08:05 AM' },
];

export const MOCK_INSTRUMENTS: Instrument[] = [
    { id: 'i1', name: 'Sysmex XN-1000', type: 'Haematology Analyser', model: 'XN-1000', serial: 'SYS-2021-4421', status: 'online', lastSync: '2 mins ago', testsToday: 142, location: 'Haematology Lab — Bench 1', qcStatus: 'PASS' },
    { id: 'i2', name: 'Cobas c501', type: 'Chemistry Analyser', model: 'c501', serial: 'COB-2020-3312', status: 'online', lastSync: '5 mins ago', testsToday: 98, location: 'Biochemistry Lab — Bench 2', qcStatus: 'PASS' },
    { id: 'i3', name: 'BioMérieux VITEK 2', type: 'Microbiology ID/AST', model: 'VITEK 2', serial: 'VIT-2022-0091', status: 'offline', lastSync: '45 mins ago', testsToday: 12, location: 'Microbiology Lab — Bench 4', qcStatus: 'PASS' },
    { id: 'i4', name: 'Cobas e411', type: 'Immunoassay Analyser', model: 'e411', serial: 'COB-2019-5521', status: 'busy', lastSync: '1 min ago', testsToday: 64, location: 'Immunology Lab — Bench 3', qcStatus: 'WARN' },
];

// ==========================================
// MOCK DATA – SENIOR MLT, DOCTOR, DISPATCH
// ==========================================

export const mockPendingSamples: PendingVerificationSample[] = [
    { id: "1", sampleId: "DH-LAB-9921", patientName: "Johnathan Doe", patientId: "PID-44571", testType: "Full Blood Count", mltName: "Kumara S.", qcStatus: "PASS", flag: "NORMAL", urgency: "ROUTINE", timeElapsed: "14 mins", verificationStatus: "PENDING" },
    { id: "2", sampleId: "DH-LAB-9925", patientName: "Sarah Wickramasinghe", patientId: "PID-38823", testType: "HbA1c Glycated Hemoglobin", mltName: "Sanduni F.", qcStatus: "PASS", flag: "HIGH", urgency: "STAT", timeElapsed: "22 mins", verificationStatus: "PENDING" },
    { id: "3", sampleId: "DH-LAB-9928", patientName: "Nimal Rajakaruna", patientId: "PID-40379", testType: "Lipid Profile", mltName: "Kumara S.", qcStatus: "PASS", flag: "NORMAL", urgency: "ROUTINE", timeElapsed: "38 mins", verificationStatus: "PENDING" },
    { id: "4", sampleId: "DH-LAB-9930", patientName: "Amara Fernado", patientId: "PID-33542", testType: "Creatinine Serum", mltName: "Sanduni F.", qcStatus: "PASS", flag: "HIGH", urgency: "STAT", timeElapsed: "45 mins", verificationStatus: "RETURNED", returnReason: "Sample was hemolyzed. Please re-collect and re-run the test before resubmitting.", returnedBy: "Dr. Aritha Perera", returnedAt: "10:41 AM" },
    { id: "5", sampleId: "DH-LAB-9932", patientName: "M. R. Mohamed", patientId: "PID-38812", testType: "CRP Quantitative", mltName: "Prasad L.", qcStatus: "PASS", flag: "NORMAL", urgency: "ROUTINE", timeElapsed: "52 mins", verificationStatus: "RETURNED", returnReason: "Critical WBC elevation requires repeat verification with fresh sample. Leukocyte aggregation noted.", returnedBy: "Dr. Aritha Perera", returnedAt: "11:15 AM" },
];

export const mockValidationSamples: ValidationSample[] = [
    { id: "1", sampleId: "S-2024-0982", patientName: "John Doe", patientInitials: "JD", patientAge: "45y", patientGender: "M", patientIdNo: "ID-882910", testType: "Full Blood Count (FBC)", department: "HEMATOLOGY", status: "CRITICAL_FLAG", urgency: "STAT", timeElapsed: "22 mins" },
    { id: "2", sampleId: "S-2024-0985", patientName: "Sarah Miller", patientInitials: "SM", patientAge: "32y", patientGender: "F", patientIdNo: "ID-772154", testType: "HbA1c Glycated Hemoglobin", department: "BIOCHEMISTRY", status: "PENDING", urgency: "ROUTINE", timeElapsed: "45 mins" },
    { id: "3", sampleId: "S-2024-0988", patientName: "Robert Brown", patientInitials: "RB", patientAge: "61y", patientGender: "M", patientIdNo: "ID-903233", testType: "Lipid Profile", department: "BIOCHEMISTRY", status: "ABNORMAL", urgency: "ROUTINE", timeElapsed: "1h 12m" },
    { id: "4", sampleId: "S-2024-1002", patientName: "Lisa Wong", patientInitials: "LW", patientAge: "28y", patientGender: "F", patientIdNo: "ID-554321", testType: "C-Reactive Protein (CRP)", department: "IMMUNOLOGY", status: "PENDING", urgency: "ROUTINE", timeElapsed: "1h 45m" },
    { id: "5", sampleId: "S-2024-1005", patientName: "Michael Taylor", patientInitials: "MT", patientAge: "52y", patientGender: "M", patientIdNo: "ID-103093", testType: "Troponin T", department: "BIOCHEMISTRY", status: "CRITICAL_FLAG", urgency: "STAT", timeElapsed: "2h 10m" },
];

export const mockDispatchReports: DispatchReport[] = [
    { id: "1", reportId: "REP-2023-9901", patientName: "Anura Kumara Jayantha", patientId: "DH-88897", testName: "Full Blood Count (FBC)", authorizedDate: "Oct 25, 2023", authorizedTime: "09:42 AM", deliveryMethods: ["EMAIL", "PRINT", "PORTAL"], status: "PENDING" },
    { id: "2", reportId: "REP-2023-9902", patientName: "Dilhani Perera", patientId: "DH-85002", testName: "Lipid Profile", authorizedDate: "Oct 25, 2023", authorizedTime: "09:15 AM", deliveryMethods: ["PRINT", "EMAIL"], status: "DELIVERED" },
    { id: "3", reportId: "REP-2023-9899", patientName: "Shirani K.", patientId: "DH-85443", testName: "HbA1c / Glycated Hb", authorizedDate: "Oct 25, 2023", authorizedTime: "08:30 AM", deliveryMethods: ["EMAIL"], status: "FAILED" },
    { id: "4", reportId: "REP-2023-9888", patientName: "L. Mahinda", patientId: "DH-85022", testName: "Thyroid Profile (T3, T4, TSH)", authorizedDate: "Oct 24, 2023", authorizedTime: "08:30 PM", deliveryMethods: ["EMAIL", "PRINT"], status: "PENDING" },
];

export const mockDeliveryRecords: DeliveryRecord[] = [
    { reportId: "REP-2023-9901", patientName: "Anura Kumara Jayantha", testName: "Full Blood Count (FBC)", methods: ["EMAIL", "PRINT"], status: "DELIVERED", dispatchedTime: "25 Oct, 09:42 AM", deliveredTime: "25 Oct, 09:43 AM" },
    { reportId: "REP-2023-9905", patientName: "Nimal Siriwardena", testName: "Lipid Profile", methods: ["PRINT"], status: "PENDING", dispatchedTime: "25 Oct, 10:15 AM", deliveredTime: null },
    { reportId: "REP-2023-9902", patientName: "Laemini Perera", testName: "HbA1C / Fasting Glucose", methods: ["EMAIL"], status: "FAILED", dispatchedTime: "25 Oct, 08:30 AM", deliveredTime: null },
];

export const mockFailedDeliveries: FailedDelivery[] = [
    { reportId: "REP-2023-9892", patientName: "Lakmini Perera", testName: "HbA1C / Fasting Glucose", method: "SMS", failureReason: "SMS Gateway Timeout", failedDateTime: "25 Oct, 08:30 AM", retryCount: 2 },
    { reportId: "REP-2023-9905", patientName: "Nimal Siriwardena", testName: "Lipid Profile", method: "EMAIL", failureReason: "Invalid email address", failedDateTime: "25 Oct, 10:15 AM", retryCount: 6 },
    { reportId: "REP-2023-9922", patientName: "Saman Kumara", testName: "Liver Function Test", method: "PRINT", failureReason: "Connection Refused", failedDateTime: "25 Oct, 11:20 AM", retryCount: 1 },
    { reportId: "REP-2023-9941", patientName: "Priya Gunawardena", testName: "Kidney Profile", method: "EMAIL", failureReason: "Mailbox Full", failedDateTime: "25 Oct, 01:45 PM", retryCount: 3 },
];

export const mockInstrumentBatches: InstrumentBatch[] = [
    { id: "1", name: "Cobas 6000", instrumentId: "INS-001", department: "Biochemistry", totalSamples: 25, normalResults: 22, exceptions: 3, qcStatus: "PASSED", isSelected: false },
    { id: "2", name: "Sysmex XN-10", instrumentId: "INS-002", department: "Hematology", totalSamples: 40, normalResults: 40, exceptions: 0, qcStatus: "PASSED", isSelected: false },
    { id: "3", name: "Vitros 5600", instrumentId: "INS-003", department: "Clinical Chem", totalSamples: 12, normalResults: 10, exceptions: 2, qcStatus: "PASSED", isSelected: false },
    { id: "4", name: "Abbott Alinity", instrumentId: "INS-004", department: "Immunology", totalSamples: 18, normalResults: 17, exceptions: 1, qcStatus: "PASSED", isSelected: false },
    { id: "5", name: "Beckman Coulter", instrumentId: "INS-005", department: "Hematology", totalSamples: 32, normalResults: 0, exceptions: 0, qcStatus: "PENDING", isSelected: false },
];
