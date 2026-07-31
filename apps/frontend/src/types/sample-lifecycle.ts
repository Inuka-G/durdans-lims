// ==========================================
// SAMPLE LIFECYCLE TYPES
// ==========================================

export type Priority = 'URGENT' | 'NORMAL' | 'STAT';

export type SampleStatus =
    | 'PENDING_COLLECTION'
    | 'COLLECTED'
    | 'RECOLLECTION_REQUIRED'
    | 'IN_TRANSIT'
    | 'RECEIVED_AT_LAB'
    | 'QUALITY_CHECK'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'IN_TESTING'
    | 'RESULT_ENTERED'
    | 'SENT_FOR_VERIFICATION'
    | 'VERIFIED'
    | 'AUTHORIZED'
    | 'DISPATCHED';

export type TubeType =
    | 'EDTA_PURPLE'
    | 'EDTA_LAVENDER'
    | 'SST_GOLD'
    | 'SST_RED'
    | 'CITRATE_BLUE'
    | 'HEPARIN_GREEN'
    | 'URINE_YELLOW'
    | 'OTHER';

export interface SamplePatient {
    id: string;
    pid: string;
    name: string;
    age: number;
    gender: 'M' | 'F';
    wardRoom?: string;
    mrn?: string;
}

export interface Sample {
    id: string;
    sampleId: string;
    orderId: string;
    patient: SamplePatient;
    testType: string;
    testCodes: string[];
    priority: Priority;
    status: SampleStatus;
    tubeTypes: TubeType[];
    collectionTime?: string;
    receivedTime?: string;
    waitTimeMinutes?: number;
    collectorName?: string;
    notes?: string;
    department?: string;
}

export interface TestResult {
    parameterId: string;
    parameterName: string;
    result: string | number;
    unit: string;
    referenceRangeLow: number;
    referenceRangeHigh: number;
    flag: 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_LOW' | 'CRITICAL_HIGH';
    isCritical: boolean;
}

export interface ResultEntry {
    sampleId: string;
    testType: string;
    results: TestResult[];
    mltNotes: string;
    criticalNotified: boolean;
    submittedAt: string;
    submittedBy: string;
}

export interface CollectionHistoryEntry {
    id: string;
    sampleId: string;
    patientName: string;
    pid: string;
    testCodes: string[];
    priority: Priority;
    status: 'COLLECTED' | 'REJECTED' | 'RECOLLECTION_REQUIRED' | 'IN_TRANSIT';
    collectedAt: string;
    collectedBy: string;
    waitTime: number;
    rejectionNotes?: string;
    tubeType?: string;
    printCount?: number;
}

export interface LabelItem {
    id: string;
    sampleId: string;
    patientName: string;
    pid: string;
    testCodes: string[];
    tubeType: string;
    tubeColor: string;
    collectedAt: string;
    printCount: number;
}

export interface Supply {
    id: string;
    name: string;
    category: string;
    tubeColor?: string;
    currentStock: number;
    minStock: number;
    maxStock: number;
    unit: string;
    lastRestocked: string;
    expiryDate: string;
}

export interface AccessioningLogEntry {
    id: string;
    sampleId: string;
    patientName: string;
    pid: string;
    testType: string;
    priority: Priority;
    action: 'VERIFIED' | 'REJECTED';
    status: SampleStatus;
    performedBy: string;
    timestamp: string;
    notes: string;
}

export interface QCRun {
    id: string;
    instrument: string;
    testGroup: string;
    level: string;
    result: string;
    expected: string;
    sd: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    performedBy: string;
    timestamp: string;
}

export type InstrumentStatus = 'online' | 'offline' | 'busy';

export interface Instrument {
    id: string;
    name: string;
    type: string;
    model: string;
    serial: string;
    status: InstrumentStatus;
    lastSync: string;
    testsToday: number;
    location: string;
    qcStatus: string;
}

export interface BarcodeSearchResult {
    sampleId: string;
    patientName: string;
    pid: string;
    testType: string;
    testCodes: string[];
    collectedAt: string;
    collectedBy: string;
    tubeType: string;
    tubeColorClass: string;
    accessionedAt: string;
    labNo: string;
}

// ─── Senior MLT, Doctor, and Dispatch Types ──────────────────────────────

export type QCStatus = "PASS" | "FAIL" | "PENDING";
export type VerificationStatus = "PENDING" | "RETURNED";
export type FlagLevel = "NORMAL" | "HIGH" | "LOW" | "CRITICAL";
export type UrgencyLevel = "ROUTINE" | "STAT";
export type DeliveryMethod = "EMAIL" | "SMS" | "WHATSAPP" | "POST" | "PRINT" | "PORTAL";
export type DeliveryStatus = "PENDING" | "DELIVERED" | "FAILED";
export type ReportStatus = "PENDING" | "DELIVERED" | "FAILED" | "PARTIAL";

export interface PendingVerificationSample {
    id: string;
    sampleId: string;
    patientName: string;
    patientId: string;
    testType: string;
    mltName: string;
    qcStatus: QCStatus;
    flag: FlagLevel;
    urgency: UrgencyLevel;
    timeElapsed: string;
    verificationStatus?: VerificationStatus;
    returnReason?: string;
    returnedBy?: string;
    returnedAt?: string;
}

export interface LabResult {
    parameter: string;
    result: string | number;
    unit: string;
    flag: FlagLevel | "—";
    referenceRange: string;
    isAbnormal: boolean;
}

export interface InstrumentBatch {
    id: string;
    name: string;
    instrumentId: string;
    department: string;
    qcStatus: "PASSED" | "PENDING";
    totalSamples: number;
    normalResults: number;
    exceptions: number;
    isSelected: boolean;
}

export interface ValidationSample {
    id: string;
    sampleId: string;
    patientName: string;
    patientInitials: string;
    patientAge: string;
    patientGender: string;
    patientIdNo: string;
    testType: string;
    department: string;
    status: "CRITICAL_FLAG" | "PENDING" | "ABNORMAL";
    urgency: UrgencyLevel;
    timeElapsed: string;
}

export interface DispatchReport {
    id: string;
    reportId: string;
    patientName: string;
    patientId: string;
    testName: string;
    authorizedDate: string;
    authorizedTime: string;
    deliveryMethods: DeliveryMethod[];
    status: ReportStatus;
}

export interface DeliveryRecord {
    reportId: string;
    patientName: string;
    testName: string;
    methods: DeliveryMethod[];
    status: DeliveryStatus;
    dispatchedTime: string;
    deliveredTime: string | null;
}

export interface FailedDelivery {
    reportId: string;
    patientName: string;
    testName: string;
    method: DeliveryMethod;
    failureReason: string;
    failedDateTime: string;
    retryCount: number;
}

