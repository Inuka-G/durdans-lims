'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { OrderPatient, LabTest } from '@/types/orders-billing';
import { formatCurrency, calculateServiceCharge, calculateTotal } from '@/constants/orders-billing';
import { getPatients, getLabTests, createOrder } from '@/lib/api';

type Priority = 'NORMAL' | 'URGENT' | 'STAT';
type SelectedLabTest = LabTest & { priority: Priority };

const calculateAge = (dob?: string) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return '';

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 0 ? age : '';
};

const mapPatientForOrder = (patient: any): OrderPatient => ({
    id: patient.patientCode ?? patient.id,
    patientId: patient.patientCode ?? patient.patientId,
    fullName: patient.fullName ?? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim(),
    age: patient.age ?? calculateAge(patient.dob),
    gender: patient.gender ?? '',
    phone: patient.phone ?? patient.phoneNumber ?? '',
});

const formatTubeType = (tubeType?: string) => {
    if (!tubeType) return 'Container per SOP';
    return tubeType
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

const formatTurnaround = (hours?: number) => {
    if (!hours) return 'TAT per lab';
    return hours === 1 ? '1 hr TAT' : `${hours} hr TAT`;
};

// ─── Page Component ───────────────────────────────────────────────────────────

export default function CreateTestOrderPage() {
    const router = useRouter();

    // ── Patient State ──────────────────────────────────────────────────────────
    const [selectedPatient, setSelectedPatient] = useState<OrderPatient | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [patientResults, setPatientResults] = useState<OrderPatient[]>([]);
    const [recentPatients, setRecentPatients] = useState<OrderPatient[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [patientSearchLoading, setPatientSearchLoading] = useState(false);
    const [recentPatientsLoading, setRecentPatientsLoading] = useState(true);

    // ── Test State ─────────────────────────────────────────────────────────────
    const [allTests, setAllTests] = useState<LabTest[]>([]);
    const [selectedTests, setSelectedTests] = useState<SelectedLabTest[]>([]);
    const [testSearchQuery, setTestSearchQuery] = useState('');
    const [testsLoading, setTestsLoading] = useState(true);
    const [testsError, setTestsError] = useState<string | null>(null);

    // ── Order State ────────────────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // ── Priority & Extras ──────────────────────────────────────────────────────
    const priority: Priority = 'NORMAL';
    const [referringDoctor, setReferringDoctor] = useState('');
    const [referringDepartment, setReferringDepartment] = useState('');
    const [remarks, setRemarks] = useState('');

    // ── Fetch Lab Tests on Mount ───────────────────────────────────────────────
    useEffect(() => {
        const fetchTests = async () => {
            try {
                setTestsLoading(true);
                setTestsError(null);
                const data = await getLabTests();
                setAllTests(Array.isArray(data) ? data : []);
            } catch (err: any) {
                setTestsError(err?.message || 'Failed to load lab tests.');
            } finally {
                setTestsLoading(false);
            }
        };
        fetchTests();
    }, []);

    useEffect(() => {
        let active = true;

        const fetchRecentPatients = async () => {
            try {
                setRecentPatientsLoading(true);
                const res = await getPatients({ page: 0, size: 5, sort: 'createdAt,desc' });
                const list = res?.content ?? res?.data?.content ?? res ?? [];
                const mapped = (Array.isArray(list) ? list : []).map(mapPatientForOrder);
                if (active) setRecentPatients(mapped);
            } catch {
                if (active) setRecentPatients([]);
            } finally {
                if (active) setRecentPatientsLoading(false);
            }
        };

        fetchRecentPatients();

        return () => {
            active = false;
        };
    }, []);

    // ── Patient Search (debounced) ─────────────────────────────────────────────
    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            setPatientResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                setPatientSearchLoading(true);
                const res = await getPatients({ keyword: searchQuery.trim() });
                const list = res?.content ?? res?.data?.content ?? res ?? [];
                const mapped: OrderPatient[] = (Array.isArray(list) ? list : []).map(mapPatientForOrder);
                setPatientResults(mapped);
            } catch {
                setPatientResults([]);
            } finally {
                setPatientSearchLoading(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleSelectPatient = (patient: OrderPatient) => {
        setSelectedPatient(patient);
        setIsSearching(false);
        setSearchQuery('');
        setPatientResults([]);
    };

    const handleChangePatient = () => {
        setSelectedPatient(null);
        setIsSearching(true);
        setSearchQuery('');
        setPatientResults([]);
    };

    const handleTestToggle = (test: LabTest) => {
        const isSelected = selectedTests.some(t => t.id === test.id);
        setSelectedTests(isSelected
            ? selectedTests.filter(t => t.id !== test.id)
            : [...selectedTests, { ...test, priority }]
        );
    };

    const handleTestPriorityChange = (testId: string, nextPriority: Priority) => {
        setSelectedTests(tests => tests.map(test =>
            test.id === testId ? { ...test, priority: nextPriority } : test
        ));
    };

    const filteredTests = allTests.filter(test =>
        test.testName.toLowerCase().includes(testSearchQuery.toLowerCase()) ||
        test.testCode.toLowerCase().includes(testSearchQuery.toLowerCase())
    );

    // ── Create Order ───────────────────────────────────────────────────────────
    const handleCreateOrder = async () => {
        if (!selectedPatient) { toast.error('Please select a patient'); return; }
        if (selectedTests.length === 0) { toast.error('Please select at least one test'); return; }

        try {
            setIsSubmitting(true);
            setSubmitError(null);
            const response = await createOrder({
                patientId: selectedPatient.id!,
                testIds: selectedTests.map(t => t.id),
                priority,
                testPriorities: Object.fromEntries(selectedTests.map(t => [t.id, t.priority])),
                referringDoctor: referringDoctor || undefined,
                referringDepartment: referringDepartment || undefined,
                remarks: remarks || undefined,
            });
            // Redirect to the new payments page, passing the order ID if available to potentially autofill search
            const orderId = response?.id || response?.orderId || '';
            router.push(`/orders-billing/payments/new${orderId ? `?orderId=${orderId}` : ''}`);
        } catch (err: any) {
            const backendMsg = err?.response?.data?.message;
            setSubmitError(backendMsg || err?.message || 'Failed to create order. Please try again.');
            setIsSubmitting(false);
        }
    };

    // ── Totals ─────────────────────────────────────────────────────────────────
    const subtotal = selectedTests.reduce((sum, test) => sum + test.price, 0);
    const serviceCharge = calculateServiceCharge(subtotal);
    const totalAmount = calculateTotal(subtotal, 0);

    return (
        <div>
            {/* ── Header ── */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Create New Test Order</h1>
                <p className="text-sm text-slate-500 mt-1">Select patient and tests to generate a laboratory order.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Left Column ── */}
                <div className="lg:col-span-2 space-y-6">

                    {/* ── Step 1: Patient Selection ── */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">1</div>
                            <h2 className="text-lg font-bold text-slate-800">Patient Selection</h2>
                        </div>

                        {/* Search input */}
                        {(isSearching || !selectedPatient) && (
                            <div className="relative mb-4">
                                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                                <input
                                    type="text"
                                    placeholder="Search Patient by Name, ID, or Phone Number..."
                                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoFocus
                                />

                                {/* Loading indicator */}
                                {patientSearchLoading && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                                        <span className="material-icons text-base animate-spin">progress_activity</span>
                                        Searching...
                                    </div>
                                )}

                                {/* Search results */}
                                {!patientSearchLoading && patientResults.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                                        {patientResults.map((patient) => (
                                            <div
                                                key={patient.id}
                                                className="flex items-center gap-3 px-4 py-3 hover:bg-primary/5 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                                                onClick={() => handleSelectPatient(patient)}
                                            >
                                                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="material-icons text-blue-600 text-lg">person</span>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-semibold text-slate-800 text-sm">{patient.fullName}</p>
                                                    <p className="text-xs text-slate-400">{patient.patientId} • {patient.age}Y / {patient.gender} • {patient.phone}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* No results */}
                                {!patientSearchLoading && searchQuery.trim().length >= 2 && patientResults.length === 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-400">
                                        No patients found for &quot;{searchQuery}&quot;
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Selected patient */}
                        {selectedPatient && !isSearching && (
                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <span className="material-icons text-blue-600">person</span>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Patient ID</p>
                                            <p className="font-bold text-slate-800 mb-2">{selectedPatient.patientId}</p>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Full Name</p>
                                            <p className="font-semibold text-slate-800 mb-2">{selectedPatient.fullName}</p>
                                            <div className="flex gap-6 text-sm">
                                                <div>
                                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Age / Gender</p>
                                                    <p className="font-medium text-slate-700">{selectedPatient.age}Y / {selectedPatient.gender}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Phone</p>
                                                    <p className="font-medium text-slate-700">{selectedPatient.phone}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={handleChangePatient} className="text-sm font-semibold text-primary hover:underline">
                                        Change
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Recent patients */}
                        {!selectedPatient && searchQuery.trim().length === 0 && (
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons text-primary text-lg">history</span>
                                        <p className="text-sm font-bold text-slate-800">Latest Patients</p>
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-400">Recently registered</span>
                                </div>

                                {recentPatientsLoading ? (
                                    <div className="px-4 py-6 text-sm text-slate-400 flex items-center justify-center gap-2">
                                        <span className="material-icons text-base animate-spin">progress_activity</span>
                                        Loading latest patients...
                                    </div>
                                ) : recentPatients.length > 0 ? (
                                    <div className="divide-y divide-slate-100">
                                        {recentPatients.map((patient) => (
                                            <button
                                                key={patient.id}
                                                type="button"
                                                onClick={() => handleSelectPatient(patient)}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="material-icons text-blue-600 text-lg">person</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-800 text-sm truncate">{patient.fullName || 'Unnamed Patient'}</p>
                                                    <p className="text-xs text-slate-400 truncate">
                                                        {patient.patientId} &bull; {patient.age ? `${patient.age}Y` : 'Age N/A'} / {patient.gender || 'N/A'} &bull; {patient.phone || 'No phone'}
                                                    </p>
                                                </div>
                                                <span className="material-icons text-slate-300 text-lg">chevron_right</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="px-4 py-6 text-sm text-slate-400 text-center">
                                        No recent patients found. Search by name, ID, or phone above.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Step 2: Test Selection ── */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">2</div>
                                <h2 className="text-lg font-bold text-slate-800">Test Selection</h2>
                            </div>
                            <div className="relative">
                                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">tune</span>
                                <input
                                    type="text"
                                    placeholder="Filter tests..."
                                    className="pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all w-48"
                                    value={testSearchQuery}
                                    onChange={(e) => setTestSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Tests loading */}
                        {testsLoading && (
                            <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
                                <span className="material-icons animate-spin">progress_activity</span>
                                <span className="text-sm">Loading lab tests...</span>
                            </div>
                        )}

                        {/* Tests error */}
                        {testsError && !testsLoading && (
                            <div className="flex items-center justify-center py-12 gap-3 text-red-400">
                                <span className="material-icons">error_outline</span>
                                <span className="text-sm">{testsError}</span>
                            </div>
                        )}

                        {/* Tests table */}
                        {!testsLoading && !testsError && (
                            <div className="overflow-hidden rounded-xl border border-slate-200">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/80">
                                            <th className="py-3 px-4 border-b border-slate-100 w-10"></th>
                                            <th className="py-3 px-4 border-b border-slate-100">Test Code</th>
                                            <th className="py-3 px-4 border-b border-slate-100">Test Name</th>
                                            <th className="py-3 px-4 border-b border-slate-100">Category</th>
                                            <th className="py-3 px-4 border-b border-slate-100">Priority</th>
                                            <th className="py-3 px-4 border-b border-slate-100 text-right">Price (LKR)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTests.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="text-center py-8 text-slate-400 text-sm">
                                                    No tests match your filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTests.map((test) => {
                                                const isChecked = selectedTests.some(t => t.id === test.id);
                                                return (
                                                    <tr
                                                        key={test.id}
                                                        className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${isChecked ? 'bg-primary/5' : 'hover:bg-slate-50/50'}`}
                                                        onClick={() => handleTestToggle(test)}
                                                    >
                                                        <td className="py-3 px-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onClick={(event) => event.stopPropagation()}
                                                                onChange={() => handleTestToggle(test)}
                                                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                                                            />
                                                        </td>
                                                        <td className="py-3 px-4 font-semibold text-slate-700">{test.testCode}</td>
                                                        <td className="py-3 px-4 text-slate-700">
                                                            <p className="font-semibold">{test.testName}</p>
                                                            <p className="mt-1 text-[11px] font-medium text-slate-400">
                                                                {test.sampleType || 'Specimen per SOP'} &bull; {formatTubeType(test.tubeType)} &bull; {formatTurnaround(test.turnAroundTimeHours)}
                                                            </p>
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-500">
                                                            <p>{test.category}</p>
                                                            {test.requiresFasting && (
                                                                <span className="mt-1 inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                                                    Fasting
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {isChecked ? (
                                                                <select
                                                                    value={selectedTests.find(t => t.id === test.id)?.priority ?? priority}
                                                                    onClick={(event) => event.stopPropagation()}
                                                                    onChange={(event) => handleTestPriorityChange(test.id, event.target.value as Priority)}
                                                                    className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                                >
                                                                    <option value="NORMAL">Normal</option>
                                                                    <option value="URGENT">Urgent</option>
                                                                    <option value="STAT">STAT</option>
                                                                </select>
                                                            ) : (
                                                                <span className="text-xs text-slate-300">Select test</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-semibold text-slate-700">{test.price.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right Column: Order Summary ── */}
                <div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 sticky top-24">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">3</div>
                            <h2 className="text-lg font-bold text-slate-800">Order Summary</h2>
                        </div>

                        {selectedTests.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-6">No tests selected yet</p>
                        ) : (
                            <div className="space-y-3 mb-6">
                                {selectedTests.map((test) => (
                                    <div key={test.id} className="flex justify-between items-start">
                                        <div className="flex-1 mr-3">
                                            <p className="font-medium text-slate-700 text-sm">{test.testName}</p>
                                            <p className="mt-0.5 text-[11px] text-slate-400">
                                                {formatTubeType(test.tubeType)} &bull; {test.sampleType || 'Specimen per SOP'}
                                            </p>
                                            <p className="text-xs text-slate-400">{test.testCode} • {test.priority}</p>
                                        </div>
                                        <p className="font-semibold text-slate-700 text-sm">{test.price.toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="border-t border-slate-100 pt-4 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Subtotal</span>
                                <span className="font-medium text-slate-700">{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Service Charge (5%)</span>
                                <span className="font-medium text-slate-700">{formatCurrency(serviceCharge)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                                <span className="font-bold text-slate-800">Total Amount</span>
                                <span className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</span>
                            </div>
                        </div>

                        {/* Submit error */}
                        {submitError && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                                {submitError}
                            </div>
                        )}

                        <div className="mt-6 space-y-3">
                            <button
                                onClick={handleCreateOrder}
                                disabled={selectedTests.length === 0 || !selectedPatient || isSubmitting}
                                className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting && <span className="material-icons text-base animate-spin">progress_activity</span>}
                                {isSubmitting ? 'Creating Order...' : 'Create Order'}
                            </button>
                            <button
                                onClick={() => router.push('/orders-billing/orders')}
                                className="w-full py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
