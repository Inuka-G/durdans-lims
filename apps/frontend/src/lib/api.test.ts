import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the axios instance so the mapper is tested in isolation (no network).
vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import axiosInstance from '@/lib/axios';
import { getPatientById, updatePatient } from '@/lib/api';

const mockedGet = axiosInstance.get as unknown as ReturnType<typeof vi.fn>;
const mockedPut = axiosInstance.put as unknown as ReturnType<typeof vi.fn>;

describe('patient API mappers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getPatientById reverse-maps the backend PatientResponse', async () => {
    mockedGet.mockResolvedValue({
      data: {
        patientCode: 'P-1',
        fullName: 'John Paul Smith',
        phone: '0771234567',
        homeNumber: '0112345678',
      },
    });

    const patient = await getPatientById('P-1');

    expect(patient.id).toBe('P-1');
    expect(patient.firstName).toBe('John');
    expect(patient.lastName).toBe('Paul Smith');
    expect(patient.phoneNumber).toBe('0771234567');
    expect(patient.alternatePhone).toBe('0112345678');
  });

  it('updatePatient sends a combined fullName and reverse-maps the response', async () => {
    mockedPut.mockResolvedValue({
      data: { patientCode: 'P-2', fullName: 'Jane Doe', phone: '0770000000' },
    });

    const result = await updatePatient('P-2', { firstName: 'Jane', lastName: 'Doe', phoneNumber: '077 000 0000' });

    // Outbound payload: names combined, phone whitespace stripped.
    const payload = mockedPut.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.fullName).toBe('Jane Doe');
    expect(payload.phone).toBe('0770000000');
    // Inbound mapping back to the frontend shape.
    expect(result.id).toBe('P-2');
    expect(result.firstName).toBe('Jane');
    expect(result.lastName).toBe('Doe');
  });
});
