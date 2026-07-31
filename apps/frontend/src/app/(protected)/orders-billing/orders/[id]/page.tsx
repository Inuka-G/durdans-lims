'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import type { OrderTrackingEvent, OrderTrackingResponse, OrderTrackingStep, TestOrder } from '@/types/orders-billing';
import { formatCurrency, ORDER_STATUS_COLORS, PAYMENT_STATUS_COLORS, formatDate } from '@/constants/orders-billing';
import { getOrderById, cancelOrder, getOrderTracking } from '@/lib/api';

// ─── Page Component ───────────────────────────────────────────────────────────

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);

    const [order, setOrder] = useState<TestOrder | null>(null);
    const [tracking, setTracking] = useState<OrderTrackingResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [trackingError, setTrackingError] = useState<string | null>(null);

    const [isCancelling, setIsCancelling] = useState(false);
    const [isCancelled, setIsCancelled] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);

    // ── Fetch Order ────────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchOrder = async () => {
            try {
                setLoading(true);
                setError(null);
                setTrackingError(null);
                const data = await getOrderById(resolvedParams.id);
                setOrder(data);
                try {
                    const trackingData = await getOrderTracking(resolvedParams.id);
                    setTracking(trackingData);
                } catch (trackingErr: any) {
                    setTrackingError(trackingErr?.message || 'Tracking timeline is not available for this order.');
                }
            } catch (err: any) {
                setError(err?.message || 'Failed to load order details.');
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [resolvedParams.id]);

    // ── Cancel Order ───────────────────────────────────────────────────────────
    const handleCancelOrder = async () => {
        try {
            setCancelLoading(true);
            setCancelError(null);
            await cancelOrder(resolvedParams.id);
            setIsCancelled(true);
            setIsCancelling(false);
        } catch (err: any) {
            setCancelError(err?.message || 'Failed to cancel order. Please try again.');
        } finally {
            setCancelLoading(false);
        }
    };

    // ── Loading State ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-slate-300 animate-spin">progress_activity</span>
                <p className="text-sm text-slate-400 font-medium">Loading order details...</p>
            </div>
        );
    }

    // ── Error State ────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-red-300">error_outline</span>
                <h2 className="text-xl font-bold text-slate-700">Failed to Load Order</h2>
                <p className="text-sm text-red-400">{error}</p>
                <button
                    onClick={() => router.push('/orders-billing/orders')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors"
                >
                    Return to Orders List
                </button>
            </div>
        );
    }

    // ── Not Found State ────────────────────────────────────────────────────────
    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-slate-300">search_off</span>
                <h2 className="text-xl font-bold text-slate-700">Order Not Found</h2>
                <p className="text-sm text-slate-400">No order matching ID: {resolvedParams.id}</p>
                <button
                    onClick={() => router.push('/orders-billing/orders')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors"
                >
                    Return to Orders List
                </button>
            </div>
        );
    }

    const canCancel = order.status === 'PENDING' && order.paymentStatus !== 'PAID' && !isCancelled;

    const subtotal = (order.tests ?? []).reduce((sum, test) => sum + (test.price ?? 0), 0);
    const serviceCharge = subtotal * 0.05;
    const totalAmount = subtotal + serviceCharge;

    return (
        <div>
            {/* Header / Nav */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={() => router.push('/orders-billing/orders')}
                    className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
                >
                    <span className="material-icons text-lg">arrow_back</span>
                    Back to Orders
                </button>

                {/* Cancel Order button — only for PENDING */}
                {canCancel && (
                    <div className="flex items-center gap-2">
                        {isCancelling ? (
                            <div className="flex gap-2 items-center bg-white border border-red-100 p-1 rounded-xl shadow-sm">
                                <span className="text-xs font-bold text-red-500 px-2 uppercase tracking-tight">Confirm cancel?</span>
                                <button
                                    onClick={() => { setIsCancelling(false); setCancelError(null); }}
                                    disabled={cancelLoading}
                                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                                >
                                    No
                                </button>
                                <button
                                    onClick={handleCancelOrder}
                                    disabled={cancelLoading}
                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                    {cancelLoading && <span className="material-icons text-sm animate-spin">progress_activity</span>}
                                    Yes, Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsCancelling(true)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                            >
                                <span className="material-icons text-lg">delete_outline</span>
                                Cancel Order
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Cancel error */}
            {cancelError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium flex items-center gap-2">
                    <span className="material-icons text-base">error_outline</span>
                    {cancelError}
                </div>
            )}

            {/* Main Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">

                {/* Banner */}
                <div className={`${isCancelled ? 'bg-slate-600' : 'bg-primary'} p-8 text-white flex justify-between items-center transition-colors duration-500`}>
                    <div>
                        <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Laboratory Order</p>
                        <h1 className="text-3xl font-bold">{order.orderId}</h1>
                    </div>
                </div>

                <div className="p-8">
                    {/* Cancelled Alert */}
                    {isCancelled && (
                        <div className="mb-8 border border-red-200 bg-red-50 rounded-2xl p-6 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                                <span className="material-icons text-red-600">error_outline</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-red-800 font-bold text-lg">Order Successfully Cancelled</h3>
                                <p className="text-red-600 text-sm mt-1 leading-relaxed">
                                    This order was cancelled on <strong>{new Date().toLocaleDateString()}</strong>.
                                    The lab records have been updated and this order will no longer appear in the daily processing queue.
                                </p>
                                <button
                                    onClick={() => router.push('/orders-billing/orders')}
                                    className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
                                >
                                    Return to Orders
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Patient Info Grid */}
                    <div className={`grid grid-cols-1 md:grid-cols-5 gap-6 mb-8 bg-slate-50/60 p-6 rounded-2xl border border-slate-100 transition-opacity ${isCancelled ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                <span className="material-icons text-blue-600">person</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Patient</p>
                                <p className="font-bold text-slate-800">{order.patientName}</p>
                                <p className="text-xs text-slate-400">{order.patientId}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                                <span className="material-icons text-violet-600">badge</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Details</p>
                                <p className="font-bold text-slate-800">{order.patientAge}Y / {order.patientGender}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <span className="material-icons text-amber-600">calendar_today</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Date</p>
                                <p className="font-bold text-slate-800">{formatDate(order.orderDate)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <span className="material-icons text-emerald-600">schedule</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Time</p>
                                <p className="font-bold text-slate-800">
                                    {order.orderDate ? new Date(order.orderDate).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
                                <span className="material-icons text-pink-600">support_agent</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Created By</p>
                                <p className="font-bold text-slate-800">{order.createdBy || 'System'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Status Section */}
                    <div className={`flex flex-wrap gap-8 mb-8 ${isCancelled ? 'opacity-40' : ''}`}>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Order Status</p>
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold ${ORDER_STATUS_COLORS[order.status]}`}>
                                {order.status.replace('_', ' ')}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Payment Status</p>
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold ${PAYMENT_STATUS_COLORS[order.paymentStatus || 'PENDING']}`}>
                                {order.paymentStatus === 'PAID' ? 'PAID' : 'NOT PAID'}
                            </span>
                        </div>
                    </div>

                    {/* Order Tracking */}
                    <div className={`mb-8 ${isCancelled ? 'opacity-40' : ''}`}>
                        <div className="flex items-center justify-between gap-4 mb-4">
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <span className="material-icons text-primary">route</span>
                                Order Tracking
                            </h3>
                            {tracking?.events?.length ? (
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    {tracking.events.length} events
                                </span>
                            ) : null}
                        </div>

                        {trackingError ? (
                            <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 text-sm text-amber-700 font-medium flex items-center gap-2">
                                <span className="material-icons text-base">info</span>
                                {trackingError}
                            </div>
                        ) : tracking ? (
                            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/70">
                                <div className="p-5 md:p-6 bg-white border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${tracking.orderStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                            <span className="material-icons">{tracking.orderStatus === 'COMPLETED' ? 'task_alt' : 'radio_button_checked'}</span>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Stage</p>
                                            <h4 className="text-xl font-black text-slate-900">{tracking.currentStage}</h4>
                                            {tracking.currentDescription && (
                                                <p className="text-sm text-slate-500 mt-1 max-w-3xl">{tracking.currentDescription}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-left lg:text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order</p>
                                        <p className="font-black text-slate-800">{tracking.orderNo}</p>
                                    </div>
                                </div>

                                <div className="p-5 md:p-6 border-b border-slate-100">
                                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                                        {(tracking.steps ?? []).map((step) => (
                                            <TrackingStepItem key={step.key} step={step} />
                                        ))}
                                    </div>
                                </div>

                                <div className="p-5 md:p-6">
                                    {(tracking.events ?? []).length > 0 ? (
                                        <div className="relative pl-8">
                                            <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200" />
                                            {tracking.events.map((event) => (
                                                <TrackingEventItem key={event.id} event={event} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center text-sm text-slate-400 font-medium">
                                            No tracking events recorded yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="border border-slate-100 rounded-2xl p-6 bg-slate-50/70 text-sm text-slate-400 font-medium flex items-center gap-2">
                                <span className="material-icons text-base animate-spin">progress_activity</span>
                                Loading tracking timeline...
                            </div>
                        )}
                    </div>

                    {/* Ordered Tests Table */}
                    <div className={isCancelled ? 'opacity-40 grayscale pointer-events-none' : ''}>
                        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="material-icons text-primary">science</span>
                            Ordered Tests
                        </h3>
                        <div className="border border-slate-100 rounded-2xl overflow-hidden">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        <th className="px-5 py-3">Test Code</th>
                                        <th className="px-4 py-3">Test Name</th>
                                        <th className="px-4 py-3">Category</th>
                                        <th className="px-4 py-3 text-right">Price (LKR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(order.tests ?? []).map((test) => (
                                        <tr key={test.testId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-5 py-3 font-semibold text-primary">{test.testCode}</td>
                                            <td className="px-4 py-3 font-medium text-slate-700">{test.testName}</td>
                                            <td className="px-4 py-3 text-slate-500">{test.category}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-700">{(test.price ?? 0).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t border-slate-100">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Subtotal</td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatCurrency(subtotal)}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Service Charge (5%)</td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatCurrency(serviceCharge)}</td>
                                    </tr>
                                    <tr className="bg-primary/5">
                                        <td colSpan={3} className="px-4 py-4 text-right text-xs font-black text-primary uppercase tracking-wider">Total Amount</td>
                                        <td className="px-4 py-4 text-right text-lg font-black text-primary">{formatCurrency(totalAmount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TrackingStepItem({ step }: { step: OrderTrackingStep }) {
    const isCompleted = step.status === 'COMPLETED';
    const isCurrent = step.status === 'CURRENT';
    const isFailed = step.status === 'FAILED';

    const icon = isCompleted ? 'check' : isFailed ? 'priority_high' : isCurrent ? 'radio_button_checked' : 'radio_button_unchecked';
    const tone = isCompleted
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : isFailed
            ? 'bg-red-100 text-red-700 border-red-200'
            : isCurrent
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-white text-slate-400 border-slate-200';

    return (
        <div className={`min-h-[104px] rounded-xl border p-3 ${tone}`}>
            <div className="flex items-center justify-between gap-2 mb-3">
                <span className="material-icons text-lg">{icon}</span>
                <span className="text-[10px] font-black uppercase tracking-wider">{step.description}</span>
            </div>
            <p className="text-sm font-black leading-tight text-slate-800">{step.label}</p>
            <p className="text-[11px] font-semibold mt-2 opacity-80">{formatTrackingTime(step.timestamp)}</p>
        </div>
    );
}

function TrackingEventItem({ event }: { event: OrderTrackingEvent }) {
    const isCompleted = event.status === 'COMPLETED';
    const isCurrent = event.status === 'CURRENT';
    const isFailed = event.status === 'FAILED';
    const dotClass = isCompleted
        ? 'bg-emerald-500 ring-emerald-100'
        : isFailed
            ? 'bg-red-500 ring-red-100'
            : isCurrent
                ? 'bg-blue-500 ring-blue-100'
                : 'bg-slate-300 ring-slate-100';

    return (
        <div className="relative pb-5 last:pb-0">
            <span className={`absolute -left-[25px] top-1 w-5 h-5 rounded-full ring-4 ${dotClass} flex items-center justify-center`}>
                <span className="material-icons text-[13px] text-white">
                    {isFailed ? 'close' : isCompleted ? 'check' : 'radio_button_checked'}
                </span>
            </span>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-black text-slate-800">{event.title}</h4>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                {event.stage}
                            </span>
                        </div>
                        {event.description && (
                            <p className="text-sm text-slate-500 mt-1 leading-relaxed">{event.description}</p>
                        )}
                    </div>
                    <p className="text-xs font-bold text-slate-400 whitespace-nowrap">{formatTrackingTime(event.timestamp)}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                    {event.testName && <TrackingMeta icon="science" value={event.testName} />}
                    {event.barcode && <TrackingMeta icon="qr_code_2" value={event.barcode} />}
                    {event.performedBy && <TrackingMeta icon="person" value={event.performedBy} />}
                    {event.method && <TrackingMeta icon="local_shipping" value={event.method} />}
                    {event.trackingNumber && <TrackingMeta icon="tag" value={event.trackingNumber} />}
                    {event.trackingUrl && (
                        <a
                            href={event.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                            <span className="material-icons text-sm">open_in_new</span>
                            Track post
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

function TrackingMeta({ icon, value }: { icon: string; value: string }) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
            <span className="material-icons text-sm text-slate-400">{icon}</span>
            {value}
        </span>
    );
}

function formatTrackingTime(value?: string | null) {
    if (!value) {
        return 'Pending';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString('en-LK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
