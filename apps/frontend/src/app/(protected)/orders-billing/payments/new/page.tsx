'use client';

import { useState, useEffect, Suspense } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDateTime, PAYMENT_METHODS } from '@/constants/orders-billing';
import { getOrders, getBillByOrderId, processPayment, getPatientById } from '@/lib/api';

type Step = 'search' | 'payment' | 'success';

const PAYMENT_STATUS_COLORS: Record<string, string> = {
    'NOT PAID': 'bg-orange-100 text-orange-700',
    'PAID': 'bg-emerald-100 text-emerald-700',
};

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
    const handleSubmit = async (e: React.FormEvent) => {
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

    // ── Step indicator ─────────────────────────────────────────────────────────
    const steps = [
        { key: 'search', label: 'Find Order', icon: 'search' },
        { key: 'payment', label: 'Payment', icon: 'payments' },
        { key: 'success', label: 'Confirm', icon: 'check_circle' },
    ];

    // =========================================================================
    // STEP 1: SEARCH
    // =========================================================================
    if (currentStep === 'search') {
        return (
            <div>
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => router.push('/orders-billing/bills')}
                        className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
                    >
                        <span className="material-icons text-lg">arrow_back</span>
                        Back to Bills & Payments
                    </button>
                </div>

                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800">Record Payment</h1>
                    <p className="text-sm text-slate-500 mt-1">Search for a patient to record a payment</p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center gap-0 mb-8">
                    {steps.map((step, idx) => (
                        <div key={step.key} className="flex items-center">
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${currentStep === step.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                                <span className="material-icons text-base">{step.icon}</span>
                                {step.label}
                            </div>
                            {idx < steps.length - 1 && (
                                <span className="material-icons text-slate-300 mx-2">chevron_right</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Search Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Search by Patient Name, Patient ID, or Order ID
                    </label>
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                            <input
                                type="text"
                                placeholder="e.g., Nimal Perera, DH-88291, INV-2023-004521..."
                                className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        {searchQuery && (
                            <button
                                onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchError(null); }}
                                className="p-3 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                <span className="material-icons text-lg">close</span>
                            </button>
                        )}
                        <button
                            onClick={() => handleSearch()}
                            disabled={isSearching}
                            className="px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
                        >
                            {isSearching && <span className="material-icons text-base animate-spin">progress_activity</span>}
                            {isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </div>

                    {/* Search Error */}
                    {searchError && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium flex items-center gap-2">
                            <span className="material-icons text-base">error_outline</span>
                            {searchError}
                        </div>
                    )}

                    {/* Search Tips */}
                    <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                        <span className="material-icons text-blue-600 text-lg mt-0.5 flex-shrink-0">info</span>
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold mb-1">Search Tips:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                                <li>Enter full or partial patient name</li>
                                <li>Use patient ID (e.g., DH-88291)</li>
                                <li>Use order ID (e.g., ORD-55429)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-bold text-slate-800">
                                {searchResults.length} bill{searchResults.length !== 1 ? 's' : ''} found
                            </h2>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {searchResults.map((bill: any) => (
                                <div key={bill.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            {/* Patient */}
                                            <div className="flex items-start gap-3 mb-4">
                                                <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="material-icons text-blue-600">person</span>
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800">{bill.patientName}</h3>
                                                    <p className="text-sm text-slate-500">
                                                        {bill.patientId} • {bill.patientPhone}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Bill Details Grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                                {[
                                                    { label: 'Bill ID', value: bill.billId, hideIfPending: true },
                                                    { label: 'Order ID', value: bill.orderId },
                                                    { label: 'Bill Date', value: bill.billDate ? new Date(bill.billDate).toLocaleString('en-LK', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—', hideIfPending: true },
                                                ]
                                                    .filter(item => !(item.hideIfPending && bill.paymentStatus === 'PENDING'))
                                                    .map(({ label, value }) => (
                                                        <div key={label}>
                                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{label}</p>
                                                            <p className="font-semibold text-slate-700 text-sm">{value}</p>
                                                        </div>
                                                    ))}
                                                <div>
                                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Status</p>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${PAYMENT_STATUS_COLORS[bill.paymentStatus] ?? ''}`}>
                                                        {bill.paymentStatus === 'PENDING' ? 'NOT PAID' : bill.paymentStatus}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Financial Summary */}
                                            <div className="flex items-center gap-6 bg-slate-50 rounded-xl p-3">
                                                <div>
                                                    <p className="text-xs text-slate-400">Total Bill</p>
                                                    <p className="font-bold text-slate-700">{formatCurrency(bill.totalAmount)}</p>
                                                </div>
                                                {bill.paidAmount > 0 && (
                                                    <div>
                                                        <p className="text-xs text-slate-400">Paid</p>
                                                        <p className="font-bold text-emerald-600">{formatCurrency(bill.paidAmount)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Process Button */}
                                        <button
                                            onClick={() => handleSelectBill(bill)}
                                            disabled={bill.outstandingAmount === 0}
                                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors flex-shrink-0 ${bill.outstandingAmount === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'}`}
                                        >
                                            <span className="material-icons text-lg">
                                                {bill.outstandingAmount === 0 ? 'check_circle' : 'payment'}
                                            </span>
                                            {bill.outstandingAmount === 0 ? 'Fully Paid' : 'Process Payment'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* No Results */}
                {!isSearching && searchQuery && searchResults.length === 0 && !searchError && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12 text-center">
                        <span className="material-icons text-5xl text-slate-300 mb-3">search_off</span>
                        <h3 className="text-lg font-bold text-slate-700 mb-1">No orders found</h3>
                        <p className="text-sm text-slate-400">Try searching with a different patient name, patient id, or order id.</p>
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

        return (
            <div>
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => { setCurrentStep('search'); }}
                        className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
                    >
                        <span className="material-icons text-lg">arrow_back</span>
                        Back
                    </button>
                </div>

                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800">Record Payment</h1>
                    <p className="text-sm text-slate-500 mt-1">Recording payment for <strong>{patient.name}</strong></p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center gap-0 mb-8">
                    {steps.map((step, idx) => (
                        <div key={step.key} className="flex items-center">
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${currentStep === step.key ? 'bg-primary text-white' : step.key === 'search' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                <span className="material-icons text-base">{step.key === 'search' ? 'check' : step.icon}</span>
                                {step.label}
                            </div>
                            {idx < steps.length - 1 && (
                                <span className="material-icons text-slate-300 mx-2">chevron_right</span>
                            )}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Patient & Bill Info */}
                    <div className="space-y-4">
                        {/* Patient */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="material-icons text-primary text-lg">person</span>
                                Patient Information
                            </h3>
                            <div className="space-y-3 text-sm">
                                {[
                                    { label: 'Name', value: patient.name },
                                    { label: 'Patient ID', value: patient.id },
                                    { label: 'Age / Gender', value: `${patient.age}Y / ${patient.gender}` },
                                    { label: 'Phone', value: patient.phone },
                                ].map(({ label, value }) => (
                                    <div key={label}>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{label}</p>
                                        <p className="font-semibold text-slate-700">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bill Summary */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="material-icons text-primary text-lg">receipt_long</span>
                                Bill Summary
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Bill ID:</span>
                                    <span className="font-semibold text-slate-700">{selectedBill.billId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Order ID:</span>
                                    <span className="font-semibold text-slate-700">{selectedBill.orderId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Order Date:</span>
                                    <span className="font-semibold text-slate-700">{selectedBill.orderDate ? formatDateTime(selectedBill.orderDate) : '—'}</span>
                                </div>
                                <div className="border-t border-slate-100 pt-2 mt-2 space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Subtotal:</span>
                                        <span>{formatCurrency(selectedBill.subtotal)}</span>
                                    </div>
                                    {selectedBill.serviceCharge > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Service Charge:</span>
                                            <span>{formatCurrency(selectedBill.serviceCharge)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-bold text-base border-t border-slate-100 pt-2">
                                        <span className="text-slate-700">Total:</span>
                                        <span className="text-slate-800">{formatCurrency(selectedBill.totalAmount)}</span>
                                    </div>
                                    {selectedBill.paidAmount > 0 && (
                                        <div className="flex justify-between text-emerald-600">
                                            <span>Paid:</span>
                                            <span className="font-bold">{formatCurrency(selectedBill.paidAmount)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tests */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="material-icons text-primary text-lg">science</span>
                                Tests Ordered
                            </h3>
                            <div className="space-y-2">
                                {(selectedBill.tests ?? []).map((test: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-start text-sm pb-2 border-b border-slate-50 last:border-0">
                                        <div>
                                            <p className="font-medium text-slate-700">{test.testName ?? test.name}</p>
                                            <p className="text-xs text-slate-400">{test.testCode ?? test.code}</p>
                                        </div>
                                        <span className="font-semibold text-slate-700">{formatCurrency(test.price ?? 0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Payment Form */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                            <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2">
                                <span className="material-icons text-primary">payments</span>
                                Payment Details
                            </h3>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* Amount */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Payment Amount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={`LKR ${parseFloat(formData.amount || '0').toFixed(2)}`}
                                        className="w-full px-4 py-3 text-2xl font-bold border border-slate-200 rounded-xl bg-slate-50 focus:outline-none cursor-not-allowed text-slate-700"
                                    />
                                </div>

                                {/* Payment Method */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Payment Method <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {PAYMENT_METHODS.map((method: any) => (
                                            <button
                                                key={method.value}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, method: method.value }))}
                                                className={`px-4 py-3 rounded-xl text-sm font-semibold border transition-colors ${formData.method === method.value ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                {method.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Bank Transfer fields */}
                                {formData.method === 'BANK_TRANSFER' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Bank Reference No <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.bankReferenceNo}
                                                onChange={e => setFormData(prev => ({ ...prev, bankReferenceNo: e.target.value }))}
                                                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                placeholder="e.g., TRF-2024-001234"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Bank Name <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                value={formData.bankName}
                                                onChange={e => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                                                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                placeholder="e.g., Bank of Ceylon"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Bank Receipt <span className="text-red-500">*</span></label>
                                            <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={e => setFormData(prev => ({ ...prev, bankReceipt: e.target.files?.[0] || null }))}
                                                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                                required
                                            />
                                            {formData.bankReceipt && (
                                                <p className="mt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                                    <span className="material-icons text-sm">check_circle</span>
                                                    {formData.bankReceipt.name}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Insurance fields */}
                                {formData.method === 'INSURANCE' && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Insurance Claim No <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={formData.insuranceClaimNo}
                                            onChange={e => setFormData(prev => ({ ...prev, insuranceClaimNo: e.target.value }))}
                                            className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                            placeholder="e.g., CLM-2024-001234"
                                            required
                                        />
                                    </div>
                                )}

                                {/* Received By */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Received By</label>
                                    <input
                                        type="text"
                                        value={formData.receivedBy}
                                        readOnly
                                        className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-500 focus:outline-none cursor-not-allowed"
                                    />
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Notes (optional)</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                        rows={3}
                                        className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                                        placeholder="Any additional notes..."
                                    />
                                </div>

                                {/* Summary before submit */}
                                {formData.amount && !isNaN(parseFloat(formData.amount)) && (
                                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Payment Summary</p>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Amount to pay:</span>
                                                <span className="font-bold text-primary text-lg">{formatCurrency(parseFloat(formData.amount) || 0)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Method:</span>
                                                <span className="font-semibold text-slate-700">{PAYMENT_METHODS.find((m: any) => m.value === formData.method)?.label}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Submit error */}
                                {submitError && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium flex items-center gap-2">
                                        <span className="material-icons text-base">error_outline</span>
                                        {submitError}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <span className="material-icons text-lg animate-spin">progress_activity</span>
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-icons text-lg">check_circle</span>
                                                Confirm Payment
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => router.push('/orders-billing/orders')}
                                        className="px-6 py-3.5 bg-white text-slate-600 border border-slate-200 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default function NewPaymentPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center p-12 text-slate-400">
                <span className="material-icons animate-spin mr-2">progress_activity</span>
                Loading...
            </div>
        }>
            <PaymentFormContent />
        </Suspense>
    );
}
