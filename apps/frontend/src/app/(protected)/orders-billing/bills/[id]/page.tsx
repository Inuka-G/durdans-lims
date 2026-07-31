'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/constants/orders-billing';
import { getBillById, getPatientById } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { Bill } from '@/types/orders-billing';

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

    // ── Loading State ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-slate-300 animate-spin">progress_activity</span>
                <p className="text-sm text-slate-400 font-medium">Loading bill details...</p>
            </div>
        );
    }

    // ── Error State ────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-red-300">error_outline</span>
                <h2 className="text-xl font-bold text-slate-700">Failed to Load Bill</h2>
                <p className="text-sm text-red-400">{error}</p>
                <button
                    onClick={() => router.push('/orders-billing/bills')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors"
                >
                    Return to Bills List
                </button>
            </div>
        );
    }

    // ── Not Found State ────────────────────────────────────────────────────────
    if (!bill) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-slate-300">receipt_long</span>
                <h2 className="text-xl font-bold text-slate-700">Bill Not Found</h2>
                <p className="text-sm text-slate-400">No bill matching ID: {resolvedParams.id}</p>
                <button
                    onClick={() => router.push('/orders-billing/bills')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors"
                >
                    Return to Bills List
                </button>
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

    return (
        <div>
            {/* Top Bar — hidden when printing */}
            <style>{`
                @media print {
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

            <div className="flex items-center justify-between mb-6 print-hidden">
                <button
                    onClick={() => router.push('/orders-billing/bills')}
                    className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
                >
                    <span className="material-icons text-lg">arrow_back</span>
                    Back to Bills
                </button>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm"
                >
                    <span className="material-icons text-lg">print</span>
                    Print Receipt
                </button>
            </div>

            <div className="print-area bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden max-w-4xl mx-auto">
                {/* Receipt Header */}
                <div className="bg-slate-900 p-10 text-white text-center">
                    <p className="text-blue-400 text-xl font-black uppercase tracking-widest mb-2">Durdans Hospital LIMS</p>
                    <h1 className="text-xl font-bold">Official Receipt</h1>
                </div>

                <div className="p-8 md:p-10">
                    {/* 2-Column Metadata Section */}
                    <div className="grid grid-cols-2 gap-12 pb-8 border-b border-slate-100">

                        {/* Left Side: Patient Information */}
                        <div className="space-y-0.5">
                            <div className="grid grid-cols-[140px_10px_1fr] py-0.5">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Patient ID</p>
                                <p>:</p>
                                <p className="font-bold text-slate-700 text-sm">{bill.patientId}</p>
                            </div>

                            <div className="grid grid-cols-[140px_10px_1fr] py-0.5">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Name</p>
                                <p>:</p>
                                <p className="font-bold text-slate-700 text-sm">{bill.patientName}</p>
                            </div>

                            <div className="grid grid-cols-[140px_10px_1fr] py-0.5">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Age</p>
                                <p>:</p>
                                <p className="font-bold text-slate-700 text-sm">{bill.patientAge ?? '—'}</p>
                            </div>

                            <div className="grid grid-cols-[140px_10px_1fr] py-0.5">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Telephone No.</p>
                                <p>:</p>
                                <p className="font-bold text-slate-700 text-sm">{bill.patientPhone}</p>
                            </div>
                        </div>

                        {/* Right Side: Bill Meta */}
                        <div className="space-y-0.5">
                            <div className="grid grid-cols-[140px_10px_1fr] py-0.5">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bill ID</p>
                                <p>:</p>
                                <p className="font-mono font-bold text-slate-700 text-sm">{bill.billId}</p>
                            </div>

                            <div className="grid grid-cols-[140px_10px_1fr] py-0.5">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Order ID</p>
                                <p>:</p>
                                <p className="font-mono font-bold text-slate-700 text-sm">{bill.orderId}</p>
                            </div>

                            <div className="grid grid-cols-[140px_10px_1fr] py-0.5">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Issued By</p>
                                <p>:</p>
                                <p className="font-bold text-slate-900 text-sm">
                                    {issuedBy}
                                </p>
                            </div>
                        </div>

                    </div>

                    {/* Itemized Charges */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4 text-slate-400">
                            <span className="material-icons text-base">receipt_long</span>
                            <span className="text-xs font-bold uppercase tracking-widest">Itemized Charges</span>
                        </div>
                        <div className="border border-slate-100 rounded-2xl overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        <th className="px-6 py-3">Service / Test Description</th>
                                        <th className="px-6 py-3 text-right">Amount (LKR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(bill.tests ?? []).map((test, index) => (
                                        <tr key={index} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-slate-700 font-medium">{test.testName ?? test.name ?? 'Test'}</td>
                                            <td className="px-6 py-4 text-right text-slate-800 font-bold">
                                                {formatCurrency(test.price ?? test.totalPrice ?? test.unitPrice ?? 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Payment Summary */}
                    <div className="max-w-xs ml-auto bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        <div className="flex justify-between text-sm mb-3">
                            <span className="text-slate-500">Subtotal</span>
                            <span className="font-semibold text-slate-700">{formatCurrency(bill.subtotal)}</span>
                        </div>
                        {bill.serviceCharge > 0 && (
                            <div className="flex justify-between text-sm mb-3">
                                <span className="text-slate-500">Service Charge (5%)</span>
                                <span className="font-semibold text-slate-700">{formatCurrency(bill.serviceCharge)}</span>
                            </div>
                        )}
                        {bill.discount > 0 && (
                            <div className="flex justify-between text-sm mb-3">
                                <span className="text-slate-500">Discount</span>
                                <span className="font-semibold text-emerald-600">-{formatCurrency(bill.discount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm mb-3 pt-3 border-t border-slate-200">
                            <span className="text-slate-500">Total Bill</span>
                            <span className="font-bold text-slate-800">{formatCurrency(bill.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-3">
                            <span className="text-slate-500">Amount Paid</span>
                            <span className="font-bold text-emerald-600">{formatCurrency(bill.paidAmount)}</span>
                        </div>
                    </div>

                    {latestPaymentNote && (
                        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div className="flex items-center gap-2 mb-2 text-slate-500">
                                <span className="material-icons text-base">notes</span>
                                <span className="text-xs font-bold uppercase tracking-widest">Special Notes</span>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{latestPaymentNote}</p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-12 flex justify-between items-center border-t border-slate-100 pt-6">
                        <p className="text-xs text-slate-400 italic">Electronically verified document</p>
                        <p className="text-xs text-slate-300 font-mono">{printDate} {printTime}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
