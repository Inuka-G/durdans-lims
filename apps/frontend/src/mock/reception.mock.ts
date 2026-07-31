// src/mock/reception.mock.ts

export interface ReceptionPatient {
    name: string;
    pid: string;
    age: number;
    gender: string;
    wardRoom?: string;
}

export interface ReceptionSample {
    id: string;
    sampleId: string;
    orderId: string;
    patient: ReceptionPatient;
    testType: string;
    collectionTime: string;
    tubeTypes: string[];
    status: 'RECEIVED' | 'PENDING' | 'REJECTED' | 'VERIFIED';
    priority: 'STAT' | 'URGENT' | 'NORMAL';
}

export const MOCK_RECEPTION_SAMPLES: ReceptionSample[] = [
    { id: 'r1', sampleId: 'S-80001', orderId: 'ORD-11001', patient: { name: 'Mohamed Shafi', pid: 'DH-40281', age: 44, gender: 'Male', wardRoom: 'ICU — Bed 02' }, testType: 'Full Blood Count', collectionTime: '08:12 AM', tubeTypes: ['EDTA', 'SST'], status: 'PENDING', priority: 'URGENT' },
    { id: 'r2', sampleId: 'S-80002', orderId: 'ORD-11002', patient: { name: 'Anula Rathnayake', pid: 'DH-38822', age: 58, gender: 'Female' }, testType: 'Lipid Profile', collectionTime: '08:25 AM', tubeTypes: ['SST'], status: 'PENDING', priority: 'NORMAL' },
    { id: 'r3', sampleId: 'S-80003', orderId: 'ORD-11003', patient: { name: 'Devin Samarasinghe', pid: 'DH-41002', age: 32, gender: 'Male' }, testType: 'Thyroid Panel', collectionTime: '08:40 AM', tubeTypes: ['SST'], status: 'RECEIVED', priority: 'NORMAL' },
    { id: 'r4', sampleId: 'S-80004', orderId: 'ORD-11004', patient: { name: 'Kanthi Wijetunge', pid: 'DH-40531', age: 67, gender: 'Female', wardRoom: 'Ward 3 — Bed 11' }, testType: 'HbA1c', collectionTime: '09:00 AM', tubeTypes: ['EDTA'], status: 'PENDING', priority: 'STAT' },
    { id: 'r5', sampleId: 'S-80005', orderId: 'ORD-11005', patient: { name: 'Ruwan Jayawardena', pid: 'DH-39021', age: 50, gender: 'Male' }, testType: 'Blood Culture', collectionTime: '09:05 AM', tubeTypes: ['PLAIN'], status: 'PENDING', priority: 'URGENT' },
    { id: 'r6', sampleId: 'S-80006', orderId: 'ORD-11006', patient: { name: 'Priya Rajan', pid: 'DH-41091', age: 27, gender: 'Female' }, testType: 'Urine Culture', collectionTime: '09:20 AM', tubeTypes: ['URINE'], status: 'PENDING', priority: 'NORMAL' },
    { id: 'r7', sampleId: 'S-80007', orderId: 'ORD-11007', patient: { name: 'Nimal Perera', pid: 'DH-38200', age: 61, gender: 'Male', wardRoom: 'CCU — Bed 01' }, testType: 'Serum Electrolytes', collectionTime: '09:30 AM', tubeTypes: ['HEPARIN'], status: 'PENDING', priority: 'URGENT' },
    { id: 'r8', sampleId: 'S-80008', orderId: 'ORD-11008', patient: { name: 'Kamala Jayasinghe', pid: 'DH-982384', age: 54, gender: 'Female', wardRoom: 'ICU — Bed 04' }, testType: 'Full Blood Count', collectionTime: '09:45 AM', tubeTypes: ['EDTA'], status: 'RECEIVED', priority: 'URGENT' },
    { id: 'r9', sampleId: 'S-80009', orderId: 'ORD-11009', patient: { name: 'Suresh Kumar', pid: 'DH-42100', age: 38, gender: 'Male' }, testType: 'Lipid Profile', collectionTime: '10:00 AM', tubeTypes: ['SST'], status: 'PENDING', priority: 'NORMAL' },
    { id: 'r10', sampleId: 'S-80010', orderId: 'ORD-11010', patient: { name: 'Dilani Fernando', pid: 'DH-43200', age: 45, gender: 'Female' }, testType: 'Thyroid Panel', collectionTime: '10:05 AM', tubeTypes: ['SST', 'EDTA'], status: 'PENDING', priority: 'NORMAL' },
];

export const MOCK_RECEPTION_STATS = {
    samplesPending: 18,
    urgentSamples: 4,
    acceptedToday: 42,
    rejectionRate: '3.8%',
};

export const MOCK_BARCODE_HISTORY = [
    { id: 'b1', sampleId: 'S-80001', patientName: 'Mohamed Shafi', pid: 'DH-40281', testType: 'Full Blood Count', printedAt: '08:15 AM', printedBy: 'Reception Desk 1' },
    { id: 'b2', sampleId: 'S-80002', patientName: 'Anula Rathnayake', pid: 'DH-38822', testType: 'Lipid Profile', printedAt: '08:28 AM', printedBy: 'Reception Desk 1' },
    { id: 'b3', sampleId: 'S-80003', patientName: 'Devin Samarasinghe', pid: 'DH-41002', testType: 'Thyroid Panel', printedAt: '08:44 AM', printedBy: 'Reception Desk 2' },
];
