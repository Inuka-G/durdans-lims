'use client';

import { useState, useEffect, Suspense, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    AlertCircle,
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronRight,
    CreditCard,
    Search,
    SearchX,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, PAYMENT_METHODS } from '@/constants/orders-billing';
import { getOrders, getBillByOrderId, processPayment, getPatientById } from '@/lib/api';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip, { humanizeStatus, toneForStatus } from '@/components/ui/StatusChip';
import { FormSection, InputField, SelectField, TextareaField } from '@/components/ui/Field';
import { formatPhone, formatRegistered } from '@/components/patient-dashboard/dashboard-data';

type Step = 'search' | 'payment' | 'success';

const CRUMBS = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Bills', href: '/orders-billing/bills' },
    { label: 'Record payment' },
];

const STEPS: { key: Step; label: string; icon: LucideIcon }[] = [
    { key: 'search', label: 'Find order', icon: Search },
    { key: 'payment', label: 'Payment', icon: CreditCard },
    { key: 'success', label: 'Confirm', icon: CheckCircle2 },
];

/** "16 Aug 2026" / "Today 09:12" — tolerant of missing or unparsable values. */
function formatBillDate(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return formatRegistered(date);
}

/** Bills come back with PENDING meaning "not paid yet"; surface that in plain words. */
function paymentStatusLabel(status?: string | null): string {
    if (!status) return '—';
    if (status === 'PENDING') return 'Not paid';
    return humanizeStatus(status);
}

function StepIndicator({ current }: { current: Step }) {
    const currentIdx = STEPS.findIndex(s => s.key === current);
    return (
        <ol aria-label="Payment steps" className="mb-5 flex flex-wrap items-center gap-1 text-sm">
            {STEPS.map((step, idx) => {
                const done = idx < currentIdx;
                const active = idx === currentIdx;
                const Icon = done ? Check : step.icon;
                return (
                    <li key={step.key} className="flex items-center gap-1">
                        <span
                            aria-current={active ? 'step' : undefined}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                                active
                                    ? 'bg-primary-soft text-primary-strong ring-primary/25'
                                    : done
                                        ? 'bg-status-verified-bg text-status-verified-fg ring-status-verified-edge'
                                        : 'bg-surface-muted text-fg-muted ring-edge'
                            )}
                        >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {step.label}
                            {done && <span className="sr-only">(completed)</span>}
                        </span>
                        {idx < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-fg-faint" aria-hidden="true" />}
                    </li>
                );
            })}
        </ol>
    );
}

function DetailRow({ label, value, emphasis = false }: { label: string; value: ReactNode; emphasis?: boolean }) {
    return (
        <div className="flex items-start justify-between gap-3 text-sm">
            <dt className="shrink-0 text-fg-muted">{label}</dt>
            <dd className={cn('min-w-0 break-words text-right tabular-nums', emphasis ? 'font-semibold text-fg' : 'font-medium text-fg-secondary')}>
                {value}
            </dd>
        </div>
    );
}

function PaymentFormContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const [currentStep, setCurrentStep] = useState<Step>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [patientDetails, setPatientDetails] = useState<{ age: string, gender: string } | null>(null);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedBill, setSelectedBill] = useState<any | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [receiptId, setReceiptId] = useState('');


    const [formData, setFormData] = useState({
        amount: '',
        method: 'CASH',
        notes: '',
        receivedBy: '',
        bankReferenceNo: '',
        bankName: '',
        insuranceClaimNo: '',
        bankReceipt: null as File | null,
    });

    // ── Search ─────────────────────────────────────────────────────────────────
    const handleSearch = async (queryToSearch: string = searchQuery) => {
        if (!queryToSearch.trim()) return;
        setHasSearched(true);
        try {
            setIsSearching(true);
            setSearchError(null);
            setSearchResults([]);

            // Fetch all orders and filter client-side by query
            const data = await getOrders(0, 100);
            const orders = data?.content ?? data ?? [];
            const q = queryToSearch.toLowerCase();

            const matched = (Array.isArray(orders) ? orders : []).filter((o: any) =>
                (o.patientName?.toLowerCase().includes(q) ||
                    o.patientId?.toLowerCase().includes(q) ||
                    o.orderId?.toLowerCase().includes(q)) &&
                o.status !== 'CANCELLED'
            );

            // Fetch bills for matched orders
            const billPromises = matched.map(async (order: any) => {
                try {
                    const bill = await getBillByOrderId(order.id ?? order.orderId);
                    return bill ?? null;
                } catch {
                    return null;
                }
            });

            const bills = (await Promise.all(billPromises)).filter(Boolean);

            // Also try direct bill ID search if query looks like INV-
            if (q.startsWith('inv-') || q.startsWith('inv')) {
                // Already covered if getBills endpoint exists — skip for now
            }

            setSearchResults(bills);
        } catch (err: any) {
            setSearchError(err?.message || 'Search failed. Please try again.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectBill = (bill: any) => {
        setSelectedBill(bill);
        setFormData(prev => ({ ...prev, amount: (bill.outstandingAmount ?? 0).toString() }));
        setCurrentStep('payment');
    };

    // ── Fetch Patient Details ──────────────────────────────────────────────────
    useEffect(() => {
        if (selectedBill?.patientId) {
            getPatientById(selectedBill.patientId)
                .then(p => {
                    let calculatedAge = '';
                    if (p.dob) {
                        const birthDate = new Date(p.dob);
                        if (!isNaN(birthDate.getTime())) {
                            const today = new Date();
                            let age = today.getFullYear() - birthDate.getFullYear();
                            const m = today.getMonth() - birthDate.getMonth();
                            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                                age--;
                            }
                            calculatedAge = age.toString();
                        }
                    }
                    if (!calculatedAge && p.age) {
                        if (!String(p.age).includes('-')) {
                            calculatedAge = String(p.age);
                        }
                    }
                    setPatientDetails({ age: calculatedAge || '—', gender: p.gender || '—' });
                })
                .catch(() => setPatientDetails({ age: '—', gender: '—' }));
        } else {
            setPatientDetails(null);
        }
    }, [selectedBill]);

    // ── Pre-fill Received By ───────────────────────────────────────────────────
    useEffect(() => {
        if (user) {
            const userName = user.name || user.preferred_username || 'Staff';
            setFormData(prev => ({ ...prev, receivedBy: userName }));
        }
    }, [user]);

    // ── Auto-search on mount if orderId is in URL ──────────────────────────────
    useEffect(() => {
        const orderId = searchParams?.get('orderId');
        if (orderId) {
            setSearchQuery(orderId);
            // Directly fetch and select the bill to jump to the payment section
            setIsSearching(true);
            getBillByOrderId(orderId)
                .then(bill => {
                    if (bill) {
                        handleSelectBill(bill);
                    } else {
                        handleSearch(orderId);
                    }
                })
                .catch(() => {
                    handleSearch(orderId);
                })
                .finally(() => {
                    setIsSearching(false);
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // ── Submit ─────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(formData.amount);

        if (isNaN(amount) || amount <= 0) { toast.error('Please enter a valid payment amount'); return; }
        if (selectedBill && amount > selectedBill.outstandingAmount) {
            toast.error(`Amount cannot exceed outstanding balance of ${formatCurrency(selectedBill.outstandingAmount)}`);
            return;
        }
        if (formData.method === 'BANK_TRANSFER') {
            if (!formData.bankReferenceNo) { toast.error('Please provide a bank reference number'); return; }
            if (!formData.bankName) { toast.error('Please provide a bank name'); return; }
            if (!formData.bankReceipt) { toast.error('Please provide a bank receipt'); return; }
        }
        if (formData.method === 'INSURANCE' && !formData.insuranceClaimNo) {
            toast.error('Please provide an insurance claim number');
            return;
        }

        try {
            setIsSubmitting(true);
            setSubmitError(null);

            const result = await processPayment(selectedBill.id, {
                billId: selectedBill.id,
                amount,
                paymentMethod: formData.method as any,
                bankReferenceNo: formData.bankReferenceNo || undefined,
                bankName: formData.bankName || undefined,
                insuranceClaimNo: formData.insuranceClaimNo || undefined,
                notes: formData.notes.trim() || undefined,
            });

            const receiptNo = result?.receiptNo ?? result?.id ?? `RCP-${Date.now()}`;

            // redirect to Bill Details page
            router.push(`/orders-billing/bills/${selectedBill.id}?receipt=${receiptNo}`);

        } catch (err: any) {
            setSubmitError(err?.message || 'Payment failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSearchSubmit = (e: FormEvent) => {
        e.preventDefault();
        handleSearch();
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setSearchError(null);
        setHasSearched(false);
    };

    // =========================================================================
    // STEP 1: SEARCH
    // =========================================================================
    if (currentStep === 'search') {
        const showNoResults = hasSearched && !isSearching && searchResults.length === 0 && !searchError;

        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader
                    crumbs={CRUMBS}
                    title="Record payment"
                    meta={<span>Find the order or bill, then record the payment against it.</span>}
                    actions={
                        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push('/orders-billing/bills')}>
                            Back to bills
                        </Button>
                    }
                />

                <StepIndicator current={currentStep} />

                {/* Search */}
                <SectionCard title="Find a bill" className="mb-4">
                    <form role="search" onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <InputField
                            id="payment-search"
                            label="Patient name, patient ID or order ID"
                            type="text"
                            autoComplete="off"
                            placeholder="e.g. Nimal Perera, DH-88291, ORD-55429"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="flex-1"
                        />
                        <div className="flex shrink-0 items-center gap-2">
                            {searchQuery && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    icon={X}
                                    aria-label="Clear search"
                                    onClick={handleClearSearch}
                                />
                            )}
                            <Button type="submit" variant="primary" icon={Search} loading={isSearching} disabled={isSearching}>
                                {isSearching ? 'Searching…' : 'Search'}
                            </Button>
                        </div>
                    </form>
                    <p className="mt-2 text-xs text-fg-muted">
                        Enter a full or partial patient name, a patient ID (e.g. DH-88291) or an order ID (e.g. ORD-55429).
                    </p>

                    {searchError && (
                        <div role="alert" className="mt-3 flex items-start gap-3 rounded-lg border border-status-danger-edge bg-status-danger-bg p-3 text-sm text-status-danger-fg">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <div className="min-w-0">
                                <p className="font-medium">Couldn&apos;t search bills</p>
                                <p className="mt-0.5 break-words">{searchError}</p>
                            </div>
                        </div>
                    )}
                </SectionCard>

                {/* Searching skeleton */}
                {isSearching && (
                    <>
                        <p role="status" aria-live="polite" className="sr-only">Searching bills</p>
                        <div aria-hidden="true" className="divide-y divide-edge rounded-lg border border-edge bg-surface">
                            {Array.from({ length: 2 }).map((_, i) => (
                                <div key={i} className="animate-pulse space-y-2 p-4">
                                    <div className="h-4 w-1/3 rounded bg-skeleton" />
                                    <div className="h-3 w-1/4 rounded bg-skeleton" />
                                    <div className="h-3 w-2/3 rounded bg-skeleton" />
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Results */}
                {!isSearching && searchResults.length > 0 && (
                    <SectionCard title="Bills found" count={searchResults.length} flush>
                        <ul className="divide-y divide-edge">
                            {searchResults.map((bill: any) => {
                                const fullyPaid = bill.outstandingAmount === 0;
                                const details = [
                                    { label: 'Bill ID', value: bill.billId, hideIfPending: true },
                                    { label: 'Order ID', value: bill.orderId },
                                    { label: 'Bill date', value: formatBillDate(bill.billDate), hideIfPending: true },
                                ].filter(item => !(item.hideIfPending && bill.paymentStatus === 'PENDING'));

                                return (
                                    <li key={bill.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-surface-hover sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate text-sm font-semibold text-fg">{bill.patientName}</p>
                                                <StatusChip tone={toneForStatus(bill.paymentStatus)} size="sm" dot>
                                                    {paymentStatusLabel(bill.paymentStatus)}
                                                </StatusChip>
                                            </div>
                                            <p className="mt-0.5 text-xs text-fg-muted">
                                                {bill.patientId} · {formatPhone(bill.patientPhone)}
                                            </p>

                                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                                                {details.map(({ label, value }) => (
                                                    <div key={label} className="min-w-0">
                                                        <dt className="text-fg-muted">{label}</dt>
                                                        <dd className="truncate font-medium text-fg-secondary">{value ?? '—'}</dd>
                                                    </div>
                                                ))}
                                                <div>
                                                    <dt className="text-fg-muted">Total</dt>
                                                    <dd className="font-medium tabular-nums text-fg-secondary">{formatCurrency(bill.totalAmount)}</dd>
                                                </div>
                                                {bill.paidAmount > 0 && (
                                                    <div>
                                                        <dt className="text-fg-muted">Paid</dt>
                                                        <dd className="font-medium tabular-nums text-status-verified-fg">{formatCurrency(bill.paidAmount)}</dd>
                                                    </div>
                                                )}
                                                <div>
                                                    <dt className="text-fg-muted">Outstanding</dt>
                                                    <dd className="font-semibold tabular-nums text-fg">{formatCurrency(bill.outstandingAmount)}</dd>
                                                </div>
                                            </dl>
                                        </div>

                                        <div className="shrink-0">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                icon={fullyPaid ? CheckCircle2 : CreditCard}
                                                disabled={fullyPaid}
                                                onClick={() => handleSelectBill(bill)}
                                                aria-label={fullyPaid ? `Bill for ${bill.patientName} is fully paid` : `Record payment for ${bill.patientName}`}
                                            >
                                                {fullyPaid ? 'Fully paid' : 'Record payment'}
                                            </Button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </SectionCard>
                )}

                {/* No results */}
                {showNoResults && (
                    <div role="status" className="rounded-lg border border-edge bg-surface">
                        <EmptyState
                            icon={SearchX}
                            title="No bills found"
                            description="Try a different patient name, patient ID or order ID."
                        />
                    </div>
                )}
            </div>
        );
    }

    // =========================================================================
    // STEP 2: PAYMENT FORM
    // =========================================================================
    if (currentStep === 'payment' && selectedBill) {
        // Normalise patient info — API returns flat fields, not nested patient object
        const patient = {
            name: selectedBill.patientName ?? selectedBill.patient?.name ?? '—',
            id: selectedBill.patientId ?? selectedBill.patient?.id ?? '—',
            phone: selectedBill.patientPhone ?? selectedBill.patient?.phone ?? '—',
            age: patientDetails?.age ?? selectedBill.patientAge ?? selectedBill.patient?.age ?? '—',
            gender: patientDetails?.gender ?? selectedBill.patientGender ?? selectedBill.patient?.gender ?? '—',
        };
        const ageGender = `${patient.age === '—' ? '—' : `${patient.age} y`} · ${patient.gender}`;
        const tests: any[] = selectedBill.tests ?? [];
        const amountNumber = parseFloat(formData.amount);
        const hasAmount = Boolean(formData.amount) && !isNaN(amountNumber);
        const methodLabel = PAYMENT_METHODS.find((m: any) => m.value === formData.method)?.label ?? formData.method;

        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader
                    crumbs={CRUMBS}
                    title="Record payment"
                    meta={
                        <>
                            <span>Recording payment for</span>
                            <span className="font-medium text-fg-secondary">{patient.name}</span>
                        </>
                    }
                    actions={
                        <Button variant="ghost" icon={ArrowLeft} onClick={() => { setCurrentStep('search'); }}>
                            Back to search
                        </Button>
                    }
                />

                <StepIndicator current={currentStep} />

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {/* Left: patient and bill */}
                        <div className="space-y-4">
                            <SectionCard title="Patient">
                                <dl className="space-y-2">
                                    <DetailRow label="Name" value={patient.name} emphasis />
                                    <DetailRow label="Patient ID" value={patient.id} />
                                    <DetailRow label="Age / gender" value={ageGender} />
                                    <DetailRow label="Phone" value={formatPhone(patient.phone === '—' ? undefined : patient.phone)} />
                                </dl>
                            </SectionCard>

                            <SectionCard title="Bill summary">
                                <dl className="space-y-2">
                                    <DetailRow label="Bill ID" value={selectedBill.billId ?? '—'} />
                                    <DetailRow label="Order ID" value={selectedBill.orderId ?? '—'} />
                                    <DetailRow label="Order date" value={formatBillDate(selectedBill.orderDate)} />
                                </dl>
                                <dl className="mt-3 space-y-2 border-t border-edge pt-3">
                                    <DetailRow label="Subtotal" value={formatCurrency(selectedBill.subtotal)} />
                                    {selectedBill.serviceCharge > 0 && (
                                        <DetailRow label="Service charge" value={formatCurrency(selectedBill.serviceCharge)} />
                                    )}
                                    <div className="border-t border-edge pt-2">
                                        <DetailRow label="Total" value={formatCurrency(selectedBill.totalAmount)} emphasis />
                                    </div>
                                    {selectedBill.paidAmount > 0 && (
                                        <DetailRow
                                            label="Paid"
                                            value={<span className="text-status-verified-fg">{formatCurrency(selectedBill.paidAmount)}</span>}
                                        />
                                    )}
                                    <DetailRow label="Outstanding" value={formatCurrency(selectedBill.outstandingAmount)} emphasis />
                                </dl>
                            </SectionCard>

                            <SectionCard title="Tests ordered" count={tests.length} flush>
                                {tests.length === 0 ? (
                                    <p className="px-4 py-3 text-sm text-fg-muted">No tests on this bill.</p>
                                ) : (
                                    <ul className="divide-y divide-edge">
                                        {tests.map((test: any, idx: number) => (
                                            <li key={idx} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-fg">{test.testName ?? test.name}</p>
                                                    <p className="text-xs text-fg-muted">{test.testCode ?? test.code}</p>
                                                </div>
                                                <span className="shrink-0 font-medium tabular-nums text-fg-secondary">{formatCurrency(test.price ?? 0)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </SectionCard>
                        </div>

                        {/* Right: payment form */}
                        <div className="space-y-4 lg:col-span-2">
                            {submitError && (
                                <div role="alert" className="flex items-start gap-3 rounded-lg border border-status-danger-edge bg-status-danger-bg p-3 text-sm text-status-danger-fg">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                    <div className="min-w-0">
                                        <p className="font-medium">Couldn&apos;t record payment</p>
                                        <p className="mt-0.5 break-words">{submitError}</p>
                                    </div>
                                </div>
                            )}

                            <FormSection title="Payment details" description="The full outstanding balance is collected. Fields marked * are required.">
                                <InputField
                                    id="payment-amount"
                                    label="Amount"
                                    type="text"
                                    readOnly
                                    value={formatCurrency(parseFloat(formData.amount || '0'))}
                                    hint="Outstanding balance on this bill"
                                />
                                <SelectField
                                    id="payment-method"
                                    label="Payment method"
                                    required
                                    value={formData.method}
                                    onChange={e => setFormData(prev => ({ ...prev, method: e.target.value }))}
                                >
                                    {PAYMENT_METHODS.map((method: any) => (
                                        <option key={method.value} value={method.value}>
                                            {method.label}
                                        </option>
                                    ))}
                                </SelectField>

                                {/* Bank transfer fields */}
                                {formData.method === 'BANK_TRANSFER' && (
                                    <>
                                        <InputField
                                            id="bank-reference-no"
                                            label="Bank reference number"
                                            required
                                            type="text"
                                            autoComplete="off"
                                            value={formData.bankReferenceNo}
                                            onChange={e => setFormData(prev => ({ ...prev, bankReferenceNo: e.target.value }))}
                                            placeholder="e.g. TRF-2024-001234"
                                        />
                                        <InputField
                                            id="bank-name"
                                            label="Bank name"
                                            required
                                            type="text"
                                            autoComplete="off"
                                            value={formData.bankName}
                                            onChange={e => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                                            placeholder="e.g. Bank of Ceylon"
                                        />
                                        <div className="min-w-0 sm:col-span-2">
                                            <label htmlFor="bank-receipt" className="mb-1 block text-xs font-medium text-fg-secondary">
                                                Bank receipt
                                                <span className="ml-0.5 text-status-danger-fg" aria-hidden="true">*</span>
                                            </label>
                                            <input
                                                id="bank-receipt"
                                                type="file"
                                                required
                                                accept="image/*,.pdf"
                                                aria-describedby="bank-receipt-hint"
                                                onChange={e => setFormData(prev => ({ ...prev, bankReceipt: e.target.files?.[0] || null }))}
                                                className="block w-full cursor-pointer rounded-md border border-edge bg-surface text-sm text-fg-secondary file:mr-3 file:rounded-l-md file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-xs file:font-medium file:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                            />
                                            <p id="bank-receipt-hint" className="mt-1 text-xs text-fg-muted">
                                                {formData.bankReceipt ? (
                                                    <span className="inline-flex items-center gap-1 text-status-verified-fg">
                                                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                                        {formData.bankReceipt.name}
                                                    </span>
                                                ) : (
                                                    'Image or PDF of the transfer receipt'
                                                )}
                                            </p>
                                        </div>
                                    </>
                                )}

                                {/* Insurance fields */}
                                {formData.method === 'INSURANCE' && (
                                    <InputField
                                        id="insurance-claim-no"
                                        label="Insurance claim number"
                                        required
                                        type="text"
                                        autoComplete="off"
                                        value={formData.insuranceClaimNo}
                                        onChange={e => setFormData(prev => ({ ...prev, insuranceClaimNo: e.target.value }))}
                                        placeholder="e.g. CLM-2024-001234"
                                    />
                                )}

                                <InputField
                                    id="received-by"
                                    label="Received by"
                                    type="text"
                                    readOnly
                                    value={formData.receivedBy}
                                    hint="Signed-in staff member"
                                />
                                <TextareaField
                                    id="payment-notes"
                                    label="Notes (optional)"
                                    rows={3}
                                    value={formData.notes}
                                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Any additional notes"
                                    className="sm:col-span-2"
                                />
                            </FormSection>

                            {hasAmount && (
                                <SectionCard title="Payment summary">
                                    <dl className="space-y-2">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <dt className="text-sm text-fg-muted">Amount to pay</dt>
                                            <dd className="text-lg font-semibold tabular-nums text-fg">{formatCurrency(amountNumber || 0)}</dd>
                                        </div>
                                        <DetailRow label="Method" value={methodLabel} />
                                        <DetailRow label="Patient" value={patient.name} />
                                    </dl>
                                </SectionCard>
                            )}
                        </div>
                    </div>

                    {/* Sticky actions */}
                    <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-between gap-3 border-t border-edge bg-canvas py-3">
                        <p className="min-w-0 truncate text-xs text-fg-muted">
                            {formatCurrency(amountNumber || 0)} · {methodLabel}
                        </p>
                        <span role="status" aria-live="polite" className="sr-only">
                            {isSubmitting ? 'Recording payment…' : ''}
                        </span>
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                            <Button type="button" variant="secondary" onClick={() => router.push('/orders-billing/orders')}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="primary" icon={CheckCircle2} loading={isSubmitting}>
                                {isSubmitting ? 'Processing…' : 'Confirm payment'}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}

export default function NewPaymentPage() {
    return (
        <Suspense
            fallback={
                <div className="mx-auto max-w-5xl">
                    <PageHeader crumbs={CRUMBS} title="Record payment" />
                    <p role="status" aria-live="polite" className="sr-only">Loading payment form</p>
                    <div aria-hidden="true" className="animate-pulse space-y-3 rounded-lg border border-edge bg-surface p-4">
                        <div className="h-3 w-1/3 rounded bg-skeleton" />
                        <div className="h-9 w-full rounded bg-skeleton" />
                        <div className="h-3 w-1/2 rounded bg-skeleton" />
                    </div>
                </div>
            }
        >
            <PaymentFormContent />
        </Suspense>
    );
}
