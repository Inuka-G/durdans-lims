// src/mock/mlt.mock.ts
// Rich mock data for MLT worklist, all-worklist, instruments

import type { InstrumentStatusItem, QcDashboardData } from '@/lib/api';

export interface MLTPatient {
    name: string;
    pid: string;
    age: number;
    gender: string;
    wardRoom?: string;
}

export interface MLTSample {
    id: string;
    sampleId: string;
    patient: MLTPatient;
    testType: string;
    department: string;
    priority: 'URGENT' | 'NORMAL' | 'STAT';
    status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'verified';
    receivedTime: string;
    assignedTo?: string;
}

export const MOCK_MLT_WORKLIST: MLTSample[] = [
    { id: '1', sampleId: 'S-10100', patient: { name: 'Mohamed Shafi', pid: 'DH-40281', age: 44, gender: 'Male', wardRoom: 'ICU — Bed 02' }, testType: 'Full Blood Count', department: 'Haematology', priority: 'URGENT', status: 'pending', receivedTime: '08:12 AM' },
    { id: '2', sampleId: 'S-10101', patient: { name: 'Anula Rathnayake', pid: 'DH-38822', age: 58, gender: 'Female' }, testType: 'Lipid Profile', department: 'Biochemistry', priority: 'NORMAL', status: 'pending', receivedTime: '08:25 AM' },
    { id: '3', sampleId: 'S-10102', patient: { name: 'Devin Samarasinghe', pid: 'DH-41002', age: 32, gender: 'Male' }, testType: 'Thyroid Panel', department: 'Immunology', priority: 'NORMAL', status: 'in_progress', receivedTime: '08:40 AM' },
    { id: '4', sampleId: 'S-10103', patient: { name: 'Kanthi Wijetunge', pid: 'DH-40531', age: 67, gender: 'Female', wardRoom: 'Ward 3 — Bed 11' }, testType: 'HbA1c', department: 'Biochemistry', priority: 'STAT', status: 'pending', receivedTime: '09:00 AM' },
    { id: '5', sampleId: 'S-10104', patient: { name: 'Ruwan Jayawardena', pid: 'DH-39021', age: 50, gender: 'Male' }, testType: 'Blood Culture', department: 'Microbiology', priority: 'URGENT', status: 'pending', receivedTime: '09:05 AM' },
    { id: '6', sampleId: 'S-10105', patient: { name: 'Priya Rajan', pid: 'DH-41091', age: 27, gender: 'Female' }, testType: 'Urine Culture', department: 'Microbiology', priority: 'NORMAL', status: 'pending', receivedTime: '09:20 AM' },
    { id: '7', sampleId: 'S-10106', patient: { name: 'Nimal Perera', pid: 'DH-38200', age: 61, gender: 'Male', wardRoom: 'CCU — Bed 01' }, testType: 'Serum Electrolytes', department: 'Biochemistry', priority: 'URGENT', status: 'in_progress', receivedTime: '09:30 AM' },
    { id: '8', sampleId: 'S-10107', patient: { name: 'Kamala Jayasinghe', pid: 'DH-982384', age: 54, gender: 'Female', wardRoom: 'ICU — Bed 04' }, testType: 'Full Blood Count', department: 'Haematology', priority: 'URGENT', status: 'pending', receivedTime: '09:45 AM' },
    { id: '9', sampleId: 'S-10108', patient: { name: 'Suresh Kumar', pid: 'DH-42100', age: 38, gender: 'Male' }, testType: 'Lipid Profile', department: 'Biochemistry', priority: 'NORMAL', status: 'pending', receivedTime: '10:00 AM' },
    { id: '10', sampleId: 'S-10109', patient: { name: 'Dilani Fernando', pid: 'DH-43200', age: 45, gender: 'Female' }, testType: 'Thyroid Panel', department: 'Immunology', priority: 'NORMAL', status: 'pending', receivedTime: '10:05 AM' },
];

export const MOCK_MLT_ALL_WORKLIST: MLTSample[] = [
    { id: 'a1', sampleId: 'S-10050', patient: { name: 'Harinda Wijesekera', pid: 'DH-31022', age: 72, gender: 'Male', wardRoom: 'Ward 5 — Bed 3' }, testType: 'Full Blood Count', department: 'Haematology', priority: 'NORMAL', status: 'verified', receivedTime: '06:45 AM' },
    { id: 'a2', sampleId: 'S-10055', patient: { name: 'Lakmali Senaratne', pid: 'DH-32911', age: 29, gender: 'Female' }, testType: 'Lipid Profile', department: 'Biochemistry', priority: 'NORMAL', status: 'completed', receivedTime: '07:10 AM' },
    { id: 'a3', sampleId: 'S-10060', patient: { name: 'Chathura Bandara', pid: 'DH-35401', age: 41, gender: 'Male' }, testType: 'Blood Culture', department: 'Microbiology', priority: 'URGENT', status: 'completed', receivedTime: '07:30 AM' },
    { id: 'a4', sampleId: 'S-10065', patient: { name: 'Nalini Gunawardena', pid: 'DH-38001', age: 55, gender: 'Female', wardRoom: 'ICU — Bed 06' }, testType: 'Serum Electrolytes', department: 'Biochemistry', priority: 'STAT', status: 'verified', receivedTime: '07:50 AM' },
    { id: 'a5', sampleId: 'S-10070', patient: { name: 'Roshan Dissanayake', pid: 'DH-36120', age: 63, gender: 'Male' }, testType: 'HbA1c', department: 'Biochemistry', priority: 'NORMAL', status: 'completed', receivedTime: '08:05 AM' },
    { id: 'a6', sampleId: 'S-10075', patient: { name: 'Sanduni Wickramasinghe', pid: 'DH-37450', age: 34, gender: 'Female' }, testType: 'Urine Culture', department: 'Microbiology', priority: 'NORMAL', status: 'completed', receivedTime: '08:20 AM' },
    { id: 'a7', sampleId: 'S-10080', patient: { name: 'Ajith Karunaratne', pid: 'DH-38901', age: 49, gender: 'Male', wardRoom: 'Ward 2 — Bed 08' }, testType: 'Thyroid Panel', department: 'Immunology', priority: 'URGENT', status: 'verified', receivedTime: '08:35 AM' },
    { id: 'a8', sampleId: 'S-10085', patient: { name: 'Preethi Senanayake', pid: 'DH-40101', age: 57, gender: 'Female' }, testType: 'Full Blood Count', department: 'Haematology', priority: 'NORMAL', status: 'completed', receivedTime: '08:50 AM' },
];

export const MOCK_MLT_STATS = {
    pendingTests: 24,
    pendingSince: '08:00 AM',
    rejectedTests: 3,
    rejectedSince: '07:30 AM',
    criticalResults: 2,
    myDrafts: 5,
};

export interface Instrument {
    id: string;
    name: string;
    type: string;
    model: string;
    serial: string;
    status: 'online' | 'offline' | 'busy';
    lastSync: string;
    testsToday: number;
    location: string;
    qcStatus: 'PASS' | 'WARN' | 'FAIL';
}

export const MOCK_INSTRUMENTS: Instrument[] = [
    { id: 'i1', name: 'Sysmex XN-1000', type: 'Haematology Analyser', model: 'XN-1000', serial: 'SYS-2021-4421', status: 'online', lastSync: '2 mins ago', testsToday: 142, location: 'Haematology Lab — Bench 2', qcStatus: 'PASS' },
    { id: 'i2', name: 'Cobas C311', type: 'Clinical Chemistry Analyser', model: 'C311', serial: 'COB-2020-8812', status: 'online', lastSync: '5 mins ago', testsToday: 98, location: 'Biochemistry Lab — Bench 1', qcStatus: 'PASS' },
    { id: 'i3', name: 'BioFire RP2.1', type: 'Molecular Diagnostics', model: 'FilmArray RP2.1', serial: 'BIO-2022-3301', status: 'offline', lastSync: '1 hr ago', testsToday: 0, location: 'Microbiology Lab — Room 3', qcStatus: 'WARN' },
    { id: 'i4', name: 'Cobas e411', type: 'Immunoassay Analyser', model: 'e411', serial: 'COB-2019-5521', status: 'busy', lastSync: '1 min ago', testsToday: 64, location: 'Immunology Lab — Bench 3', qcStatus: 'WARN' },
];

/** Used when the API is unreachable — mirrors typical LIS QC summaries. */
export const MOCK_QC_DASHBOARD_DATA: QcDashboardData = {
    totalRuns: 6,
    passed: 5,
    warnings: 1,
    failures: 0,
    runs: [
        {
            id: 'qc-mock-1',
            instrument: 'Sysmex XN-1000',
            testGroup: 'Full Blood Count',
            level: 'Normal',
            result: '5.2',
            expected: '5.0 ± 0.3',
            sd: '0.7 SD',
            status: 'PASS',
            performedBy: 'MLT (offline demo)',
            timestamp: '08:15 AM',
        },
        {
            id: 'qc-mock-2',
            instrument: 'Roche cobas c 311',
            testGroup: 'Chemistry — Level 1',
            level: 'Normal',
            result: '182',
            expected: '180 ± 6',
            sd: '0.33 SD',
            status: 'PASS',
            performedBy: 'MLT (offline demo)',
            timestamp: '08:42 AM',
        },
        {
            id: 'qc-mock-3',
            instrument: 'Roche cobas c 311',
            testGroup: 'HbA1c QC',
            level: 'High',
            result: '9.8',
            expected: '8.5 ± 0.4',
            sd: '3.25 SD',
            status: 'WARN',
            performedBy: 'MLT (offline demo)',
            timestamp: '09:05 AM',
        },
        {
            id: 'qc-mock-4',
            instrument: 'Urine workstation',
            testGroup: 'Urinalysis dipstick',
            level: 'Negative control',
            result: 'Negative',
            expected: 'Negative',
            sd: '—',
            status: 'PASS',
            performedBy: 'MLT (offline demo)',
            timestamp: '09:20 AM',
        },
        {
            id: 'qc-mock-5',
            instrument: 'Sysmex XN-1000',
            testGroup: 'Full Blood Count',
            level: 'Low',
            result: '2.05',
            expected: '2.0 ± 0.2',
            sd: '0.25 SD',
            status: 'PASS',
            performedBy: 'MLT (offline demo)',
            timestamp: '09:55 AM',
        },
        {
            id: 'qc-mock-6',
            instrument: 'Immunoassay analyser',
            testGroup: 'TSH line',
            level: 'Normal',
            result: '2.1',
            expected: '2.0 ± 0.15',
            sd: '0.67 SD',
            status: 'PASS',
            performedBy: 'MLT (offline demo)',
            timestamp: '10:10 AM',
        },
    ],
};

export const MOCK_INSTRUMENT_STATUS_FALLBACK: InstrumentStatusItem[] = MOCK_INSTRUMENTS.map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    model: i.model,
    serial: i.serial,
    status: i.status,
    lastSync: i.lastSync,
    testsToday: i.testsToday,
    location: i.location,
    qcStatus: i.qcStatus,
}));

// Import simulation: number of results queued per instrument
export const INSTRUMENT_IMPORT_COUNTS: Record<string, number> = {
    i1: 12,
    i2: 8,
    i3: 0,
    i4: 5,
};
