'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Printer, Receipt, StickyNote } from 'lucide-react';
import { formatCurrency } from '@/constants/orders-billing';
import { getBillById, getPatientById } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { Bill } from '@/types/orders-billing';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatPhone } from '@/components/patient-dashboard/dashboard-data';

type BillPaymentWithNotes = {
    notes?: unknown;
};

type BillTestLine = {
    testName?: string;
    name?: string;
    price?: number;
    unitPrice?: number;
    totalPrice?: number;
};

type BillDetails = Omit<Bill, 'payments' | 'tests'> & {
    patientAge?: number;
    patientGender?: string;
    issuedBy?: string;
    payments?: BillPaymentWithNotes[];
    tests?: BillTestLine[];
};

type PatientDetails = {
    age?: number;
    dob?: string;
};

type AuthUser = {
    name?: unknown;
    preferred_username?: unknown;
};

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Failed to load bill details.';
}

function getDisplayName(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : undefined;
}

const BILLS_CRUMBS = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders and billing', href: '/orders-billing' },
    { label: 'Bills', href: '/orders-billing/bills' },
];

/** Label : value row used in the receipt metadata block. */
function MetaRow({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
    return (
        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 py-1">
            <dt className="text-xs text-fg-muted">{label}</dt>
            <dd className={mono ? 'break-all font-mono text-xs font-medium text-fg' : 'break-words text-sm font-medium text-fg'}>
                {children}
            </dd>
        </div>
    );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function BillDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);

    const { user } = useAuth() as { user?: AuthUser };
    const [bill, setBill] = useState<BillDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [printDate] = useState(() => new Date().toLocaleDateString('en-GB'));
    const [printTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    useEffect(() => {
        const fetchBill = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await getBillById(resolvedParams.id) as BillDetails;

                // If age missing, fetch patient details
                if (!data.patientAge || !data.patientGender) {
                    try {
                        const patient = await getPatientById(data.patientId) as PatientDetails;

                        // Age calculation if missing
                        if (!data.patientAge) {
                            if (patient.age) {
                                data.patientAge = patient.age;
                            } else if (patient.dob) {
                                const birthDate = new Date(patient.dob);
                                const today = new Date();
                                let age = today.getFullYear() - birthDate.getFullYear();
                                const m = today.getMonth() - birthDate.getMonth();
                                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                                    age--;
                                }
                                data.patientAge = age;
                            }
                        }

                    } catch (pErr) {
                        console.error('Failed to fetch patient details for age/gender', pErr);
                    }
                }

                setBill(data);
            } catch (err: unknown) {
                setError(getErrorMessage(err));
            } finally {
                setLoading(false);
            }
        };

        fetchBill();
    }, [resolvedParams.id]);

    const backToBills = () => router.push('/orders-billing/bills');

    // ── Loading State ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader title="Bill" crumbs={[...BILLS_CRUMBS, { label: 'Loading…' }]} />
                <p role="status" aria-live="polite" className="sr-only">
                    Loading bill details
                </p>
                <div aria-hidden="true" className="overflow-hidden rounded-lg border border-edge bg-surface">
                    <div className="border-b border-edge bg-surface-muted px-6 py-6">
                        <span className="mx-auto block h-4 w-40 rounded bg-skeleton" />
                        <span className="mx-auto mt-2 block h-3 w-24 rounded bg-skeleton" />
                    </div>
                    <div className="space-y-6 p-6 md:p-8">
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            {Array.from({ length: 2 }).map((_, col) => (
                                <div key={col} className="space-y-2">
                                    {Array.from({ length: 4 }).map((__, row) => (
                                        <span key={row} className="flex items-center gap-3">
                                            <span className="h-3 w-24 rounded bg-skeleton" />
                                            <span className="h-3 w-36 rounded bg-skeleton" />
                                        </span>
                                    ))}
                                </div>
                            ))}
                        </div>
                        <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <span key={i} className="flex items-center justify-between">
                                    <span className="h-3 w-1/2 rounded bg-skeleton" />
                                    <span className="h-3 w-20 rounded bg-skeleton" />
                                </span>
                            ))}
                        </div>
                        <div className="ml-auto max-w-xs space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <span key={i} className="flex items-center justify-between">
                                    <span className="h-3 w-24 rounded bg-skeleton" />
                                    <span className="h-3 w-20 rounded bg-skeleton" />
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Error State ────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader title="Bill" crumbs={[...BILLS_CRUMBS, { label: resolvedParams.id }]} />
                <div role="alert" className="rounded-lg border border-edge bg-surface">
                    <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load bill"
                        description={error}
                        action={
                            <Button size="sm" icon={ArrowLeft} onClick={backToBills}>
                                Back to bills
                            </Button>
                        }
                    />
                </div>
            </div>
        );
    }

    // ── Not Found State ────────────────────────────────────────────────────────
    if (!bill) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader title="Bill" crumbs={[...BILLS_CRUMBS, { label: resolvedParams.id }]} />
                <div role="status" className="rounded-lg border border-edge bg-surface">
                    <EmptyState
                        icon={Receipt}
                        title="Bill not found"
                        description={`No bill matches ID ${resolvedParams.id}.`}
                        action={
                            <Button size="sm" icon={ArrowLeft} onClick={backToBills}>
                                Back to bills
                            </Button>
                        }
                    />
                </div>
            </div>
        );
    }

    const issuedBy = getDisplayName(user?.name)
        ?? getDisplayName(user?.preferred_username)
        ?? bill.issuedBy
        ?? 'System';
    const paymentsWithNotes = Array.isArray(bill.payments) ? bill.payments : [];
    const latestPaymentNote = [...paymentsWithNotes].reverse()
        .find((payment) => typeof payment.notes === 'string' && payment.notes.trim())
        ?.notes as string | undefined;
    const lines = bill.tests ?? [];

    return (
        <div className="mx-auto max-w-5xl">
            {/* Print: only the receipt is visible. The receipt is token-driven, so in dark mode its
                text would print near-white on paper; re-pin the tokens it uses to the light palette
                from globals.css (print-only — screen rendering stays fully token-based). */}
            <style>{`
                @media print {
                    html.dark, :root {
                        color-scheme: light;
                        --surface: #ffffff;
                        --surface-muted: #f8fafc;
                        --surface-hover: #f1f5f9;
                        --edge: #e2e8f0;
                        --fg: #0f172a;
                        --fg-secondary: #334155;
                        --fg-muted: #64748b;
                        --fg-faint: #94a3b8;
                        --status-verified-bg: #ecfdf5;
                        --status-verified-fg: #047857;
                        --status-verified-edge: #a7f3d0;
                        --status-pending-bg: #fffbeb;
                        --status-pending-fg: #b45309;
                        --status-pending-edge: #fde68a;
                    }

                    body * {
                        visibility: hidden;
                    }

                    .print-area, .print-area * {
                        visibility: visible;
                    }

                    .print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }

                    .print-hidden {
                        display: none !important;
                    }

                    @page {
                        margin: 0;
                    }

                    body {
                        margin: 1.5cm;
                    }
                }
            `}</style>

            <div className="print-hidden">
                <PageHeader
                    title={`Bill ${bill.billId}`}
                    crumbs={[...BILLS_CRUMBS, { label: bill.billId }]}
                    meta={
                        <>
                            <span className="min-w-0 truncate" title={bill.patientName}>{bill.patientName}</span>
                            <span aria-hidden="true">·</span>
                            <span className="min-w-0 break-all font-mono text-xs">{bill.patientId}</span>
                            <span aria-hidden="true">·</span>
                            <StatusBadge status={bill.paymentStatus} />
                        </>
                    }
                    actions={
                        <>
                            <Button icon={ArrowLeft} onClick={backToBills}>
                                Back to bills
                            </Button>
                            <Button variant="primary" icon={Printer} onClick={() => window.print()}>
                                Print receipt
                            </Button>
                        </>
                    }
                />
            </div>

            <article className="print-area overflow-hidden rounded-lg border border-edge bg-surface" aria-labelledby="receipt-title">
                {/* Receipt header */}
                <header className="border-b border-edge bg-surface-muted px-6 py-6 text-center">
                    <p className="text-base font-semibold tracking-wide text-fg">Durdans Hospital LIMS</p>
                    <h2 id="receipt-title" className="mt-0.5 text-sm text-fg-muted">
                        Official receipt
                    </h2>
                </header>

                <div className="p-6 md:p-8">
                    {/* Patient + bill metadata */}
                    <div className="grid grid-cols-1 gap-x-10 gap-y-4 border-b border-edge pb-6 sm:grid-cols-2">
                        <dl>
                            <MetaRow label="Patient ID" mono>{bill.patientId}</MetaRow>
                            <MetaRow label="Name">{bill.patientName}</MetaRow>
                            <MetaRow label="Age">{bill.patientAge ?? '—'}</MetaRow>
                            <MetaRow label="Telephone">{formatPhone(bill.patientPhone)}</MetaRow>
                        </dl>
                        <dl>
                            <MetaRow label="Bill ID" mono>{bill.billId}</MetaRow>
                            <MetaRow label="Order ID" mono>{bill.orderId}</MetaRow>
                            <MetaRow label="Issued by">{issuedBy}</MetaRow>
                            <MetaRow label="Payment status">
                                <StatusBadge status={bill.paymentStatus} />
                            </MetaRow>
                        </dl>
                    </div>

                    {/* Itemised charges */}
                    <section className="mt-6" aria-labelledby="charges-title">
                        <h3 id="charges-title" className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
                            <Receipt className="h-4 w-4 text-fg-faint" aria-hidden="true" />
                            Itemised charges
                        </h3>
                        <div className="overflow-x-auto rounded-md border border-edge">
                            <table className="w-full min-w-[360px] table-fixed text-left text-sm">
                                <thead>
                                    <tr className="border-b border-edge bg-surface-muted text-xs font-semibold text-fg-muted">
                                        <th scope="col" className="py-2 pl-4 pr-3 font-semibold">
                                            Service / test
                                        </th>
                                        <th scope="col" className="w-40 px-3 py-2 text-right font-semibold">
                                            Amount (LKR)
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge">
                                    {lines.map((test, index) => (
                                        <tr key={index} className="transition-colors hover:bg-surface-hover">
                                            <td className="break-words py-2 pl-4 pr-3 font-medium text-fg">{test.testName ?? test.name ?? 'Test'}</td>
                                            <td className="px-3 py-2 text-right tabular-nums text-fg">
                                                {formatCurrency(test.price ?? test.totalPrice ?? test.unitPrice ?? 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {lines.length === 0 && (
                            <p className="mt-2 text-xs text-fg-muted">No line items on this bill.</p>
                        )}
                    </section>

                    {/* Payment summary */}
                    <dl className="ml-auto mt-6 max-w-xs rounded-md border border-edge bg-surface-muted p-4 text-sm">
                        <div className="flex items-center justify-between gap-4 py-1">
                            <dt className="text-fg-muted">Subtotal</dt>
                            <dd className="tabular-nums text-fg">{formatCurrency(bill.subtotal)}</dd>
                        </div>
                        {bill.serviceCharge > 0 && (
                            <div className="flex items-center justify-between gap-4 py-1">
                                <dt className="text-fg-muted">Service charge (5%)</dt>
                                <dd className="tabular-nums text-fg">{formatCurrency(bill.serviceCharge)}</dd>
                            </div>
                        )}
                        {bill.discount > 0 && (
                            <div className="flex items-center justify-between gap-4 py-1">
                                <dt className="text-fg-muted">Discount</dt>
                                <dd className="tabular-nums text-fg">−{formatCurrency(bill.discount)}</dd>
                            </div>
                        )}
                        <div className="mt-1 flex items-center justify-between gap-4 border-t border-edge pt-2">
                            <dt className="font-medium text-fg">Total bill</dt>
                            <dd className="font-semibold tabular-nums text-fg">{formatCurrency(bill.totalAmount)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4 py-1">
                            <dt className="text-fg-muted">Amount paid</dt>
                            <dd className="font-semibold tabular-nums text-status-verified-fg">{formatCurrency(bill.paidAmount)}</dd>
                        </div>
                    </dl>

                    {latestPaymentNote && (
                        <section className="mt-6 rounded-md border border-edge bg-surface-muted p-4" aria-labelledby="notes-title">
                            <h3 id="notes-title" className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-fg-muted">
                                <StickyNote className="h-4 w-4 text-fg-faint" aria-hidden="true" />
                                Notes
                            </h3>
                            <p className="whitespace-pre-wrap break-words text-sm text-fg">{latestPaymentNote}</p>
                        </section>
                    )}

                    {/* Footer */}
                    <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-edge pt-4 text-xs text-fg-muted">
                        <p>Electronically verified document</p>
                        <p className="tabular-nums text-fg-faint">
                            {printDate} {printTime}
                        </p>
                    </footer>
                </div>
            </article>
        </div>
    );
}
