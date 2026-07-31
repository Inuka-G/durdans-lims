// src/mock/result-entry.mock.ts

export type FlagType = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_HIGH' | 'CRITICAL_LOW';

export interface TestParameter {
    id: string;
    parameterName: string;
    result: string;
    unit: string;
    referenceRangeLow: number;
    referenceRangeHigh: number;
    flag: FlagType;
}

export interface TestGroup {
    groupName: string;
    parameters: TestParameter[];
}

export interface ResultEntryData {
    sampleId: string;
    patientName: string;
    patientPid: string;
    patientAge: number;
    patientGender: string;
    wardRoom: string;
    collectionTime: string;
    testType: string;
    isUrgent: boolean;
    urgentNote?: string;
    testGroups: TestGroup[];
}

// Computes a flag based on value vs reference range
export function computeFlag(value: number, low: number, high: number): FlagType {
    if (value < low * 0.7 || value > high * 1.3) {
        return value < low ? 'CRITICAL_LOW' : 'CRITICAL_HIGH';
    }
    if (value < low) return 'LOW';
    if (value > high) return 'HIGH';
    return 'NORMAL';
}

export const MOCK_RESULT_ENTRY: ResultEntryData = {
    sampleId:       'S-10100',
    patientName:    'Mohamed Shafi',
    patientPid:     'DH-40281',
    patientAge:     44,
    patientGender:  'Male',
    wardRoom:       'ICU — Bed 02',
    collectionTime: '08:12 AM',
    testType:       'Full Blood Count | Serum Electrolytes',
    isUrgent:       true,
    urgentNote:     'Note: Stat request from ICU. Requires immediate validation.',
    testGroups: [
        {
            groupName: 'COMPLETE BLOOD COUNT',
            parameters: [
                { id: 'wbc', parameterName: 'WBC (White Blood Cells)',  result: '7.2',  unit: '10³/µL', referenceRangeLow: 4,    referenceRangeHigh: 10,   flag: 'NORMAL' },
                { id: 'rbc', parameterName: 'RBC (Red Blood Cells)',    result: '3.9',  unit: '10⁶/µL', referenceRangeLow: 4.5,  referenceRangeHigh: 5.5,  flag: 'LOW'    },
                { id: 'hgb', parameterName: 'Hemoglobin',               result: '11.2', unit: 'g/dL',   referenceRangeLow: 12,   referenceRangeHigh: 17,   flag: 'LOW'    },
                { id: 'hct', parameterName: 'Hematocrit (HCT)',         result: '34.5', unit: '%',       referenceRangeLow: 36,   referenceRangeHigh: 50,   flag: 'LOW'    },
                { id: 'plt', parameterName: 'Platelets',                result: '185',  unit: '10³/µL', referenceRangeLow: 150,  referenceRangeHigh: 400,  flag: 'NORMAL' },
            ],
        },
        {
            groupName: 'SERUM ELECTROLYTES',
            parameters: [
                { id: 'na',  parameterName: 'Sodium (Na+)',      result: '138', unit: 'mmol/L', referenceRangeLow: 135, referenceRangeHigh: 145, flag: 'NORMAL'        },
                { id: 'k',   parameterName: 'Potassium (K+)',    result: '6.8', unit: 'mmol/L', referenceRangeLow: 3.5, referenceRangeHigh: 5.1, flag: 'CRITICAL_HIGH' },
                { id: 'cl',  parameterName: 'Chloride (Cl-)',    result: '102', unit: 'mmol/L', referenceRangeLow: 96,  referenceRangeHigh: 106, flag: 'NORMAL'        },
                { id: 'hco', parameterName: 'Bicarbonate (HCO3-)', result: '22', unit: 'mmol/L', referenceRangeLow: 22,  referenceRangeHigh: 28,  flag: 'NORMAL'       },
            ],
        },
    ],
};
