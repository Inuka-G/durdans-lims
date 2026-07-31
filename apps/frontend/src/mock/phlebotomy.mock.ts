// src/mock/phlebotomy.mock.ts

export interface PhlebPatient {
    name: string;
    pid: string;
    age: number;
    gender: string;
    wardRoom?: string;
}

export interface PhlebSample {
    id: string;
    sampleId: string;
    orderId: string;
    patient: PhlebPatient;
    priority: 'STAT' | 'URGENT' | 'NORMAL';
    testType: string;
    testCodes: string[];
    tubeTypes: string[];
    waitTimeMinutes: number;
    status?: string;
}

export const MOCK_WORKLIST: PhlebSample[] = [
    { id: 'p1', sampleId: 'S-90010', orderId: 'ORD-22100', patient: { name: 'Mohamed Shafi', pid: 'DH-40281', age: 44, gender: 'Male', wardRoom: 'ICU — Bed 02' }, priority: 'STAT', testType: 'Full Blood Count', testCodes: ['FBC', 'CRP'], tubeTypes: ['EDTA', 'SST'], waitTimeMinutes: 5 },
    { id: 'p2', sampleId: 'S-90011', orderId: 'ORD-22101', patient: { name: 'Anula Rathnayake', pid: 'DH-38822', age: 58, gender: 'Female' }, priority: 'NORMAL', testType: 'Lipid Profile', testCodes: ['Lipid', 'Gluc'], tubeTypes: ['SST'], waitTimeMinutes: 18 },
    { id: 'p3', sampleId: 'S-90012', orderId: 'ORD-22102', patient: { name: 'Devin Samarasinghe', pid: 'DH-41002', age: 32, gender: 'Male' }, priority: 'URGENT', testType: 'Blood Culture', testCodes: ['BC'], tubeTypes: ['PLAIN'], waitTimeMinutes: 35 },
    { id: 'p4', sampleId: 'S-90013', orderId: 'ORD-22103', patient: { name: 'Kanthi Wijetunge', pid: 'DH-40531', age: 67, gender: 'Female', wardRoom: 'Ward 3 — Bed 11' }, priority: 'STAT', testType: 'Thyroid Panel', testCodes: ['TSH', 'T4'], tubeTypes: ['SST'], waitTimeMinutes: 8 },
    { id: 'p5', sampleId: 'S-90014', orderId: 'ORD-22104', patient: { name: 'Ruwan Jayawardena', pid: 'DH-39021', age: 50, gender: 'Male' }, priority: 'NORMAL', testType: 'Urine Culture', testCodes: ['UC'], tubeTypes: ['URINE'], waitTimeMinutes: 12 },
    { id: 'p6', sampleId: 'S-90015', orderId: 'ORD-22105', patient: { name: 'Priya Rajan', pid: 'DH-41091', age: 27, gender: 'Female' }, priority: 'NORMAL', testType: 'HbA1c', testCodes: ['HbA1c'], tubeTypes: ['EDTA'], waitTimeMinutes: 22 },
    { id: 'p7', sampleId: 'S-90016', orderId: 'ORD-22106', patient: { name: 'Nimal Perera', pid: 'DH-38200', age: 61, gender: 'Male', wardRoom: 'CCU — Bed 01' }, priority: 'URGENT', testType: 'Serum Electrolytes', testCodes: ['Na', 'K', 'Cl'], tubeTypes: ['HEPARIN'], waitTimeMinutes: 40 },
    { id: 'p8', sampleId: 'S-90017', orderId: 'ORD-22107', patient: { name: 'Sanduni Wickramasinghe', pid: 'DH-37450', age: 34, gender: 'Female' }, priority: 'NORMAL', testType: 'PT/INR', testCodes: ['PT', 'INR'], tubeTypes: ['CITRATE'], waitTimeMinutes: 15 },
];

export const MOCK_DASHBOARD_STATS = {
    pendingCollections: 24,
    urgentSamples: 5,
    collectedToday: 61,
    rejections: 3,
};
