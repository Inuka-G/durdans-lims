'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
    AlertCircle,
    AlertTriangle,
    ChevronRight,
    ClipboardPlus,
    FlaskConical,
    Loader2,
    Search,
    SearchX,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import type { OrderPatient, LabTest } from '@/types/orders-billing';
import { formatCurrency, calculateServiceCharge, calculateTotal } from '@/constants/orders-billing';
import { getPatients, getLabTests, createOrder } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip from '@/components/ui/StatusChip';
import { FormSection, InputField, TextareaField } from '@/components/ui/Field';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatPhone, patientInitials } from '@/components/patient-dashboard/dashboard-data';

type Priority = 'NORMAL' | 'URGENT' | 'STAT';
type SelectedLabTest = LabTest & { priority: Priority };

const SKELETON_ROWS = 6;

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

/** "34 / Male" — keeps the page's own age + gender values, with em-dash fallbacks. */
const formatAgeSex = (patient: OrderPatient) => {
    const age = String(patient.age ?? '').trim() || '—';
    return `${age} / ${patient.gender || '—'}`;
};

const SEARCH_ICON_CLASS = 'pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-fg-faint';

const ROW_BUTTON_CLASS =
    'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-hover ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary';

const PRIORITY_SELECT_CLASS =
    'h-7 w-28 rounded-md border border-edge bg-surface px-2 text-xs font-medium text-fg ' +
    'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

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
    const loadTests = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        loadTests();
    }, [loadTests]);

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
            setPatientSearchLoading(false);
            return;
        }
        setPatientSearchLoading(true);
        const timer = setTimeout(async () => {
            try {
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

    const showPatientSearch = isSearching || !selectedPatient;
    const trimmedQuery = searchQuery.trim();
    const canSubmit = Boolean(selectedPatient) && selectedTests.length > 0 && !isSubmitting;

    const readiness = !selectedPatient
        ? 'Select a patient to continue.'
        : selectedTests.length === 0
            ? 'Select at least one test to continue.'
            : `${selectedTests.length} ${selectedTests.length === 1 ? 'test' : 'tests'} · ${formatCurrency(totalAmount)}`;

    const renderPatientRow = (patient: OrderPatient) => (
        <li key={patient.id}>
            <button type="button" onClick={() => handleSelectPatient(patient)} className={ROW_BUTTON_CLASS}>
                <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-skeleton text-[11px] font-semibold text-fg-secondary"
                >
                    {patientInitials(patient.fullName)}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-fg">{patient.fullName || 'Unnamed patient'}</span>
                    <span className="block truncate text-xs text-fg-muted">
                        <span className="font-mono">{patient.patientId || '—'}</span>
                        <span className="text-fg-faint"> · </span>
                        <span className="tabular-nums">{formatAgeSex(patient)}</span>
                        <span className="text-fg-faint"> · </span>
                        <span className="tabular-nums">{formatPhone(patient.phone)}</span>
                    </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
            </button>
        </li>
    );

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                crumbs={[{ label: 'Orders & billing', href: '/orders-billing/orders' }, { label: 'Create order' }]}
                title="Create order"
                meta={<span>Select a patient and the tests to generate a laboratory order.</span>}
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* ── Left column ── */}
                <div className="space-y-4 lg:col-span-2">
                    {/* ── Step 1: Patient ── */}
                    <SectionCard
                        title="Patient"
                        actions={
                            selectedPatient && !isSearching ? (
                                <Button size="sm" variant="ghost" icon={Search} onClick={handleChangePatient}>
                                    Change patient
                                </Button>
                            ) : undefined
                        }
                    >
                        {showPatientSearch && (
                            <div className="space-y-3">
                                <div className="relative">
                                    <InputField
                                        label="Search patients"
                                        hideLabel
                                        type="text"
                                        autoComplete="off"
                                        placeholder="Search by name, patient ID or phone"
                                        className="[&_input]:pl-9"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                    <Search className={SEARCH_ICON_CLASS} aria-hidden="true" />
                                </div>

                                {/* Search feedback */}
                                <div role="status" aria-live="polite">
                                    {trimmedQuery.length > 0 && trimmedQuery.length < 2 && (
                                        <p className="text-xs text-fg-muted">Type at least 2 characters to search.</p>
                                    )}
                                    {patientSearchLoading && trimmedQuery.length >= 2 && (
                                        <p className="flex items-center gap-2 text-xs text-fg-muted">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-strong" aria-hidden="true" />
                                            Searching patients…
                                        </p>
                                    )}
                                </div>

                                {/* Search results */}
                                {!patientSearchLoading && trimmedQuery.length >= 2 && (
                                    patientResults.length > 0 ? (
                                        <div className="overflow-hidden rounded-lg border border-edge">
                                            <p className="border-b border-edge bg-surface-muted px-3 py-1.5 text-xs font-medium text-fg-muted">
                                                {patientResults.length} {patientResults.length === 1 ? 'match' : 'matches'}
                                            </p>
                                            <ul className="divide-y divide-edge">{patientResults.map(renderPatientRow)}</ul>
                                        </div>
                                    ) : (
                                        <EmptyState
                                            compact
                                            icon={SearchX}
                                            title={`No patients match "${trimmedQuery}"`}
                                            description="Check the spelling, or search by patient ID or phone number."
                                        />
                                    )
                                )}

                                {/* Recent patients */}
                                {trimmedQuery.length === 0 && (
                                    <div className="overflow-hidden rounded-lg border border-edge" aria-busy={recentPatientsLoading}>
                                        <p className="border-b border-edge bg-surface-muted px-3 py-1.5 text-xs font-medium text-fg-muted">
                                            Recently registered
                                        </p>
                                        {recentPatientsLoading ? (
                                            <ul aria-hidden="true" className="divide-y divide-edge">
                                                {Array.from({ length: 3 }).map((_, i) => (
                                                    <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                                                        <span className="h-8 w-8 shrink-0 rounded-full bg-skeleton" />
                                                        <span className="h-3 w-36 rounded bg-skeleton" />
                                                        <span className="hidden h-3 w-24 rounded bg-skeleton sm:block" />
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : recentPatients.length > 0 ? (
                                            <ul className="divide-y divide-edge">{recentPatients.map(renderPatientRow)}</ul>
                                        ) : (
                                            <EmptyState
                                                compact
                                                icon={Users}
                                                title="No recent patients"
                                                description="Search by name, patient ID or phone above."
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Selected patient */}
                        {selectedPatient && !isSearching && (
                            <div className="flex items-start gap-3 rounded-lg border border-edge bg-surface-muted p-3">
                                <span
                                    aria-hidden="true"
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-skeleton text-xs font-semibold text-fg-secondary"
                                >
                                    {patientInitials(selectedPatient.fullName)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-medium text-fg">{selectedPatient.fullName || 'Unnamed patient'}</p>
                                        <StatusChip tone="success" size="sm" dot>
                                            Selected
                                        </StatusChip>
                                    </div>
                                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                                        <div className="min-w-0">
                                            <dt className="text-fg-muted">Patient ID</dt>
                                            <dd className="truncate font-mono text-fg-secondary">{selectedPatient.patientId || '—'}</dd>
                                        </div>
                                        <div className="min-w-0">
                                            <dt className="text-fg-muted">Age / sex</dt>
                                            <dd className="truncate tabular-nums text-fg-secondary">{formatAgeSex(selectedPatient)}</dd>
                                        </div>
                                        <div className="min-w-0">
                                            <dt className="text-fg-muted">Phone</dt>
                                            <dd className="truncate tabular-nums text-fg-secondary">{formatPhone(selectedPatient.phone)}</dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        )}
                    </SectionCard>

                    {/* ── Step 2: Tests ── */}
                    <SectionCard
                        title="Tests"
                        count={!testsLoading && !testsError ? filteredTests.length : undefined}
                        flush
                        actions={
                            <>
                                <span className="hidden text-xs tabular-nums text-fg-muted sm:inline" aria-live="polite">
                                    {selectedTests.length} selected
                                </span>
                                <div className="relative">
                                    <InputField
                                        label="Filter tests"
                                        hideLabel
                                        type="text"
                                        autoComplete="off"
                                        placeholder="Filter by code or name"
                                        className="w-44 sm:w-56 [&_input]:pl-9"
                                        value={testSearchQuery}
                                        onChange={(e) => setTestSearchQuery(e.target.value)}
                                    />
                                    <Search className={SEARCH_ICON_CLASS} aria-hidden="true" />
                                </div>
                            </>
                        }
                    >
                        <div aria-busy={testsLoading}>
                            {testsLoading ? (
                                <ul aria-hidden="true" className="divide-y divide-edge">
                                    {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                                        <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                            <span className="h-4 w-4 shrink-0 rounded bg-skeleton" />
                                            <span className="h-3 w-16 rounded bg-skeleton" />
                                            <span className="h-3 w-48 rounded bg-skeleton" />
                                            <span className="ml-auto hidden h-3 w-20 rounded bg-skeleton md:block" />
                                            <span className="hidden h-3 w-14 rounded bg-skeleton sm:block" />
                                        </li>
                                    ))}
                                </ul>
                            ) : testsError ? (
                                <EmptyState
                                    icon={AlertTriangle}
                                    title="Couldn't load tests"
                                    description={testsError}
                                    action={
                                        <Button size="sm" onClick={loadTests}>
                                            Retry
                                        </Button>
                                    }
                                />
                            ) : filteredTests.length === 0 ? (
                                testSearchQuery.trim() ? (
                                    <EmptyState
                                        icon={SearchX}
                                        title={`No tests match "${testSearchQuery.trim()}"`}
                                        description="Try a different test code or name."
                                        action={
                                            <Button size="sm" onClick={() => setTestSearchQuery('')}>
                                                Clear filter
                                            </Button>
                                        }
                                    />
                                ) : (
                                    <EmptyState
                                        icon={FlaskConical}
                                        title="No tests in the catalogue"
                                        description="Ask an administrator to add lab tests before creating orders."
                                    />
                                )
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[720px] table-fixed text-left text-[13px]">
                                        <thead>
                                            <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                                <th scope="col" className="w-10 py-2 pl-4 pr-2">
                                                    <span className="sr-only">Select</span>
                                                </th>
                                                <th scope="col" className="w-[13%] px-3 py-2 font-medium">Code</th>
                                                <th scope="col" className="px-3 py-2 font-medium">Test</th>
                                                <th scope="col" className="hidden w-[16%] px-3 py-2 font-medium lg:table-cell">Category</th>
                                                <th scope="col" className="w-[19%] px-3 py-2 font-medium">Priority</th>
                                                <th scope="col" className="w-[15%] px-3 py-2 pr-4 text-right font-medium">Price (LKR)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-edge whitespace-nowrap">
                                            {filteredTests.map((test) => {
                                                const isChecked = selectedTests.some(t => t.id === test.id);
                                                return (
                                                    <tr
                                                        key={test.id}
                                                        data-selected={isChecked || undefined}
                                                        className={`cursor-pointer transition-colors ${isChecked ? 'bg-primary-soft' : 'hover:bg-surface-hover'}`}
                                                        onClick={() => handleTestToggle(test)}
                                                    >
                                                        <td className="py-2 pl-4 pr-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                aria-label={`Select ${test.testName}`}
                                                                onClick={(event) => event.stopPropagation()}
                                                                onChange={() => handleTestToggle(test)}
                                                                className="h-4 w-4 rounded border-edge-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                                            />
                                                        </td>
                                                        <td className="truncate px-3 py-2 font-mono text-xs text-fg-secondary">{test.testCode}</td>
                                                        <td className="px-3 py-2">
                                                            <p className="truncate font-medium text-fg">{test.testName}</p>
                                                            <p className="truncate text-xs text-fg-muted">
                                                                {test.sampleType || 'Specimen per SOP'}
                                                                <span className="text-fg-faint"> · </span>
                                                                {formatTubeType(test.tubeType)}
                                                                <span className="text-fg-faint"> · </span>
                                                                {formatTurnaround(test.turnAroundTimeHours)}
                                                                {test.requiresFasting && (
                                                                    <StatusChip tone="pending" size="sm" className="ml-1.5 align-middle">
                                                                        Fasting
                                                                    </StatusChip>
                                                                )}
                                                            </p>
                                                        </td>
                                                        <td className="hidden px-3 py-2 text-fg-secondary lg:table-cell">
                                                            <p className="truncate">{test.category}</p>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {isChecked ? (
                                                                <select
                                                                    value={selectedTests.find(t => t.id === test.id)?.priority ?? priority}
                                                                    aria-label={`Priority for ${test.testName}`}
                                                                    onClick={(event) => event.stopPropagation()}
                                                                    onChange={(event) => handleTestPriorityChange(test.id, event.target.value as Priority)}
                                                                    className={PRIORITY_SELECT_CLASS}
                                                                >
                                                                    <option value="NORMAL">Normal</option>
                                                                    <option value="URGENT">Urgent</option>
                                                                    <option value="STAT">STAT</option>
                                                                </select>
                                                            ) : (
                                                                <span className="text-xs text-fg-faint">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 pr-4 text-right tabular-nums text-fg">{test.price.toLocaleString()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    {/* ── Referral (optional) ── */}
                    <FormSection title="Referral" description="Optional. Who requested the tests and any notes for the lab.">
                        <InputField
                            label="Referring doctor"
                            placeholder="Dr. name"
                            autoComplete="off"
                            value={referringDoctor}
                            onChange={(e) => setReferringDoctor(e.target.value)}
                        />
                        <InputField
                            label="Referring department"
                            placeholder="e.g. OPD, Ward 3"
                            autoComplete="off"
                            value={referringDepartment}
                            onChange={(e) => setReferringDepartment(e.target.value)}
                        />
                        <TextareaField
                            label="Remarks"
                            placeholder="Clinical notes or special instructions"
                            rows={2}
                            className="sm:col-span-2"
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                        />
                    </FormSection>
                </div>

                {/* ── Right column: Order summary ── */}
                <div>
                    <SectionCard title="Order summary" count={selectedTests.length} flush className="lg:sticky lg:top-20">
                        {/* Patient line */}
                        <div className="flex items-center gap-2 border-b border-edge px-4 py-2.5 text-[13px]">
                            <UserRound className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                            {selectedPatient ? (
                                <span className="min-w-0 truncate text-fg">
                                    <span className="font-medium">{selectedPatient.fullName || 'Unnamed patient'}</span>
                                    <span className="text-fg-faint"> · </span>
                                    <span className="font-mono text-xs text-fg-secondary">{selectedPatient.patientId || '—'}</span>
                                </span>
                            ) : (
                                <span className="text-fg-muted">No patient selected</span>
                            )}
                        </div>

                        {/* Line items */}
                        {selectedTests.length === 0 ? (
                            <EmptyState
                                compact
                                icon={FlaskConical}
                                title="No tests selected"
                                description="Tick tests in the catalogue to add them to this order."
                            />
                        ) : (
                            <ul className="max-h-[40vh] divide-y divide-edge overflow-y-auto">
                                {selectedTests.map((test) => (
                                    <li key={test.id} className="flex items-start gap-2 px-4 py-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13px] font-medium text-fg">{test.testName}</p>
                                            <p className="truncate text-xs text-fg-muted">
                                                <span className="font-mono">{test.testCode}</span>
                                                <span className="text-fg-faint"> · </span>
                                                {formatTubeType(test.tubeType)}
                                                <span className="text-fg-faint"> · </span>
                                                {test.sampleType || 'Specimen per SOP'}
                                            </p>
                                            <div className="mt-1">
                                                <PriorityBadge priority={test.priority} />
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-[13px] tabular-nums text-fg">{test.price.toLocaleString()}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleTestToggle(test)}
                                            aria-label={`Remove ${test.testName}`}
                                            className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                        >
                                            <X className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {/* Totals */}
                        <dl className="space-y-2 border-t border-edge px-4 py-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-fg-muted">Subtotal</dt>
                                <dd className="tabular-nums text-fg-secondary">{formatCurrency(subtotal)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-fg-muted">Service charge (5%)</dt>
                                <dd className="tabular-nums text-fg-secondary">{formatCurrency(serviceCharge)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3 border-t border-edge pt-2">
                                <dt className="font-semibold text-fg">Total</dt>
                                <dd className="text-lg font-semibold tabular-nums text-fg">{formatCurrency(totalAmount)}</dd>
                            </div>
                        </dl>

                        {/* Submit error */}
                        <div role="alert" aria-live="assertive">
                            {submitError && (
                                <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-status-danger-edge bg-status-danger-bg p-3 text-xs text-status-danger-fg">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                    <div className="min-w-0">
                                        <p className="font-medium">Couldn&apos;t create order</p>
                                        <p className="mt-0.5 break-words">{submitError}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </SectionCard>
                </div>
            </div>

            {/* ── Sticky action bar ── */}
            <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-between gap-3 border-t border-edge bg-canvas py-3">
                <div role="status" aria-live="polite" className="flex min-w-0 items-center gap-2 text-xs text-fg-muted">
                    {isSubmitting ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary-strong" aria-hidden="true" />
                            <span className="truncate font-medium text-fg-secondary">Creating order…</span>
                        </>
                    ) : (
                        <span className="truncate tabular-nums">{readiness}</span>
                    )}
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Button variant="secondary" onClick={() => router.push('/orders-billing/orders')}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        icon={ClipboardPlus}
                        loading={isSubmitting}
                        disabled={!canSubmit}
                        onClick={handleCreateOrder}
                    >
                        {isSubmitting ? 'Creating order…' : 'Create order'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
