'use client';

import { useState, useEffect, useCallback, use, type ReactNode } from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    Ban,
    Check,
    CheckCircle2,
    Circle,
    CircleDot,
    ExternalLink,
    FlaskConical,
    Hash,
    Info,
    QrCode,
    Route,
    SearchX,
    Truck,
    User,
    X,
    type LucideIcon,
} from 'lucide-react';
import type { OrderTrackingEvent, OrderTrackingResponse, OrderTrackingStatus, OrderTrackingStep, TestOrder } from '@/types/orders-billing';
import { formatCurrency } from '@/constants/orders-billing';
import { getOrderById, cancelOrder, getOrderTracking } from '@/lib/api';
import Button from '@/components/ui/Button';
import PageHeader, { type Crumb } from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import StatusChip, { humanizeStatus, type ChipTone } from '@/components/ui/StatusChip';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatRegistered } from '@/components/patient-dashboard/dashboard-data';

const ORDER_CRUMBS: Crumb[] = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Orders & billing', href: '/orders-billing' },
    { label: 'Orders', href: '/orders-billing/orders' },
];

/** Tracking step / event status → chip tone (colour = meaning). */
const TRACKING_TONE: Record<OrderTrackingStatus, ChipTone> = {
    COMPLETED: 'success',
    CURRENT: 'info',
    PENDING: 'neutral',
    FAILED: 'danger',
};

function toDate(value?: string | null): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/** "16 Aug 2026, 09:12" — full, unambiguous date + 24h time. */
function formatDateTime(value?: string | null): string {
    const d = toDate(value);
    if (!d) return '—';
    return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
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

    // Stable reference so the Modal's focus/keyboard effect doesn't re-run every render.
    const closeCancelDialog = useCallback(() => {
        setIsCancelling(false);
        setCancelError(null);
    }, []);

    // ── Loading State ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader title="Order" crumbs={[...ORDER_CRUMBS, { label: 'Loading…' }]} />
                <p role="status" aria-live="polite" className="sr-only">
                    Loading order details
                </p>
                <div aria-hidden="true" className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        <div className="rounded-lg border border-edge bg-surface p-4">
                            <span className="block h-4 w-24 rounded bg-skeleton" />
                            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <span key={i} className="block h-10 rounded bg-skeleton" />
                                ))}
                            </div>
                        </div>
                        <div className="rounded-lg border border-edge bg-surface p-4">
                            <span className="block h-4 w-32 rounded bg-skeleton" />
                            <div className="mt-4 space-y-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <span key={i} className="block h-8 rounded bg-skeleton" />
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-lg border border-edge bg-surface p-4">
                            <span className="block h-4 w-28 rounded bg-skeleton" />
                            <div className="mt-4 space-y-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <span key={i} className="block h-4 rounded bg-skeleton" />
                                ))}
                            </div>
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
                <PageHeader title="Order" crumbs={[...ORDER_CRUMBS, { label: resolvedParams.id }]} />
                <div role="alert" className="rounded-lg border border-edge bg-surface">
                    <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load order"
                        description={error}
                        action={
                            <Button size="sm" icon={ArrowLeft} href="/orders-billing/orders">
                                Back to orders
                            </Button>
                        }
                    />
                </div>
            </div>
        );
    }

    // ── Not Found State ────────────────────────────────────────────────────────
    if (!order) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader title="Order" crumbs={[...ORDER_CRUMBS, { label: resolvedParams.id }]} />
                <div className="rounded-lg border border-edge bg-surface">
                    <EmptyState
                        icon={SearchX}
                        title="Order not found"
                        description={`No order matches ID ${resolvedParams.id}.`}
                        action={
                            <Button size="sm" icon={ArrowLeft} href="/orders-billing/orders">
                                Back to orders
                            </Button>
                        }
                    />
                </div>
            </div>
        );
    }

    const canCancel = order.status === 'PENDING' && order.paymentStatus !== 'PAID' && !isCancelled;

    const subtotal = (order.tests ?? []).reduce((sum, test) => sum + (test.price ?? 0), 0);
    const serviceCharge = subtotal * 0.05;
    const totalAmount = subtotal + serviceCharge;

    const isPaid = order.paymentStatus === 'PAID';
    const orderDate = toDate(order.orderDate);
    const tests = order.tests ?? [];
    const events = tracking?.events ?? [];
    const steps = tracking?.steps ?? [];
    const dimmed = isCancelled ? 'opacity-60' : undefined;

    return (
        <div className="mx-auto max-w-5xl">
            <PageHeader
                title={`Order ${order.orderId}`}
                crumbs={[...ORDER_CRUMBS, { label: order.orderId }]}
                meta={
                    <>
                        <StatusBadge status={isCancelled ? 'CANCELLED' : order.status} />
                        <StatusChip tone={isPaid ? 'success' : 'pending'} dot>
                            {isPaid ? 'Paid' : 'Not paid'}
                        </StatusChip>
                        <span aria-hidden="true">·</span>
                        <span>
                            Ordered{' '}
                            {orderDate ? (
                                <time dateTime={orderDate.toISOString()} title={formatDateTime(order.orderDate)}>
                                    {formatRegistered(orderDate)}
                                </time>
                            ) : (
                                '—'
                            )}
                        </span>
                    </>
                }
                actions={
                    <>
                        <Button variant="ghost" icon={ArrowLeft} href="/orders-billing/orders">
                            Back to orders
                        </Button>
                        {canCancel && (
                            <Button icon={Ban} onClick={() => setIsCancelling(true)}>
                                Cancel order
                            </Button>
                        )}
                    </>
                }
            />

            {/* Cancelled notice */}
            {isCancelled && (
                <div
                    role="status"
                    className="mb-4 flex flex-col gap-3 rounded-lg border border-status-danger-edge bg-status-danger-bg p-4 sm:flex-row sm:items-start"
                >
                    <AlertTriangle className="h-5 w-5 shrink-0 text-status-danger-fg" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-status-danger-fg">Order cancelled</p>
                        <p className="mt-0.5 text-xs text-fg-secondary">
                            Cancelled {formatRegistered(new Date())}. The lab records have been updated and this order will no
                            longer appear in the daily processing queue.
                        </p>
                    </div>
                    <Button size="sm" icon={ArrowLeft} href="/orders-billing/orders" className="shrink-0">
                        Back to orders
                    </Button>
                </div>
            )}

            <div className={dimmed}>
                <div className="grid gap-4 lg:grid-cols-3">
                    {/* Left column */}
                    <div className="space-y-4 lg:col-span-2">
                        {/* Patient */}
                        <SectionCard title="Patient">
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                                <DetailItem label="Name" value={order.patientName || '—'} className="col-span-2 sm:col-span-1" />
                                <DetailItem label="Patient ID" value={order.patientId || '—'} mono />
                                <DetailItem
                                    label="Age / sex"
                                    value={`${order.patientAge != null ? `${order.patientAge}y` : '—'} / ${order.patientGender || '—'}`}
                                />
                            </dl>
                        </SectionCard>

                        {/* Ordered tests */}
                        <SectionCard title="Ordered tests" count={tests.length} flush>
                            {tests.length === 0 ? (
                                <EmptyState compact icon={FlaskConical} title="No tests on this order" />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[560px] table-fixed text-left text-sm">
                                        <caption className="sr-only">Tests on this order</caption>
                                        <thead>
                                            <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                                <th scope="col" className="w-28 py-2 pl-4 pr-3 font-semibold">
                                                    Code
                                                </th>
                                                <th scope="col" className="px-3 py-2 font-semibold">
                                                    Test
                                                </th>
                                                <th scope="col" className="hidden w-36 px-3 py-2 font-semibold md:table-cell">
                                                    Category
                                                </th>
                                                <th scope="col" className="w-36 px-3 py-2 text-right font-semibold">
                                                    Price
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-edge whitespace-nowrap">
                                            {tests.map((test) => (
                                                <tr key={test.testId} className="transition-colors hover:bg-surface-hover">
                                                    <td className="truncate py-2 pl-4 pr-3 font-mono text-xs font-medium text-primary-strong">
                                                        {test.testCode}
                                                    </td>
                                                    <td className="truncate px-3 py-2 font-medium text-fg" title={test.testName}>
                                                        {test.testName}
                                                    </td>
                                                    <td className="hidden truncate px-3 py-2 text-fg-muted md:table-cell">
                                                        {test.category || '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-fg-secondary">
                                                        {formatCurrency(test.price ?? 0)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="border-t border-edge bg-surface-muted text-xs">
                                            <tr>
                                                <td colSpan={2} className="py-2 pl-4 pr-3 text-right text-fg-muted">
                                                    Subtotal
                                                </td>
                                                <td className="hidden px-3 py-2 md:table-cell" />
                                                <td className="px-3 py-2 text-right tabular-nums text-fg-secondary">{formatCurrency(subtotal)}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={2} className="py-2 pl-4 pr-3 text-right text-fg-muted">
                                                    Service charge (5%)
                                                </td>
                                                <td className="hidden px-3 py-2 md:table-cell" />
                                                <td className="px-3 py-2 text-right tabular-nums text-fg-secondary">
                                                    {formatCurrency(serviceCharge)}
                                                </td>
                                            </tr>
                                            <tr className="border-t border-edge">
                                                <td colSpan={2} className="py-2.5 pl-4 pr-3 text-right font-medium text-fg">
                                                    Total
                                                </td>
                                                <td className="hidden px-3 py-2.5 md:table-cell" />
                                                <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-fg">
                                                    {formatCurrency(totalAmount)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </SectionCard>

                        {/* Order tracking */}
                        <SectionCard title="Order tracking" count={tracking ? events.length : undefined}>
                            {trackingError ? (
                                <div
                                    role="status"
                                    className="flex items-start gap-2 rounded-md border border-status-pending-edge bg-status-pending-bg p-3 text-xs text-status-pending-fg"
                                >
                                    <Info className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                                    <span>{trackingError}</span>
                                </div>
                            ) : tracking ? (
                                <div className="space-y-4">
                                    {/* Current stage */}
                                    <div className="flex flex-col gap-3 rounded-md border border-edge bg-surface-muted p-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex min-w-0 items-start gap-3">
                                            {tracking.orderStatus === 'COMPLETED' ? (
                                                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-verified-fg" aria-hidden="true" />
                                            ) : (
                                                <Route className="mt-0.5 h-5 w-5 shrink-0 text-primary-strong" aria-hidden="true" />
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-xs text-fg-muted">Current stage</p>
                                                <p className="text-sm font-semibold text-fg">{tracking.currentStage}</p>
                                                {tracking.currentDescription && (
                                                    <p className="mt-0.5 text-xs text-fg-muted">{tracking.currentDescription}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="min-w-0 text-left sm:text-right">
                                            <p className="text-xs text-fg-muted">Order</p>
                                            <p className="truncate font-mono text-xs font-medium text-fg" title={tracking.orderNo}>
                                                {tracking.orderNo}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Steps */}
                                    {steps.length > 0 && (
                                        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Tracking steps">
                                            {steps.map((step) => (
                                                <TrackingStepItem key={step.key} step={step} />
                                            ))}
                                        </ol>
                                    )}

                                    {/* Events */}
                                    {events.length > 0 ? (
                                        <ol className="relative ml-2 border-l border-edge pl-6" aria-label="Tracking events">
                                            {events.map((event) => (
                                                <TrackingEventItem key={event.id} event={event} />
                                            ))}
                                        </ol>
                                    ) : (
                                        <EmptyState
                                            compact
                                            icon={Route}
                                            title="No tracking events yet"
                                            description="Events are recorded as the order moves through the lab."
                                        />
                                    )}
                                </div>
                            ) : (
                                <div aria-hidden="true" className="space-y-2">
                                    <span className="block h-12 rounded bg-skeleton" />
                                    <span className="block h-16 rounded bg-skeleton" />
                                    <span className="block h-16 rounded bg-skeleton" />
                                </div>
                            )}
                        </SectionCard>
                    </div>

                    {/* Right column */}
                    <div className="space-y-4">
                        <SectionCard title="Order summary">
                            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                                <dt className="text-xs text-fg-muted">Status</dt>
                                <dd>
                                    <StatusBadge status={isCancelled ? 'CANCELLED' : order.status} />
                                </dd>
                                <dt className="text-xs text-fg-muted">Payment</dt>
                                <dd>
                                    <StatusChip tone={isPaid ? 'success' : 'pending'} dot>
                                        {isPaid ? 'Paid' : 'Not paid'}
                                    </StatusChip>
                                </dd>
                                <dt className="text-xs text-fg-muted">Ordered</dt>
                                <dd className="tabular-nums text-fg">{formatDateTime(order.orderDate)}</dd>
                                <dt className="text-xs text-fg-muted">Created by</dt>
                                <dd className="truncate text-fg" title={order.createdBy || undefined}>
                                    {order.createdBy || 'System'}
                                </dd>
                                {order.orderingPhysician && (
                                    <>
                                        <dt className="text-xs text-fg-muted">Physician</dt>
                                        <dd className="truncate text-fg" title={order.orderingPhysician}>
                                            {order.orderingPhysician}
                                        </dd>
                                    </>
                                )}
                            </dl>
                        </SectionCard>

                        <SectionCard title="Billing summary">
                            <dl className="space-y-2 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-fg-muted">Subtotal</dt>
                                    <dd className="tabular-nums text-fg-secondary">{formatCurrency(subtotal)}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-fg-muted">Service charge (5%)</dt>
                                    <dd className="tabular-nums text-fg-secondary">{formatCurrency(serviceCharge)}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3 border-t border-edge pt-2">
                                    <dt className="font-medium text-fg">Total</dt>
                                    <dd className="text-base font-semibold tabular-nums text-fg">{formatCurrency(totalAmount)}</dd>
                                </div>
                            </dl>
                        </SectionCard>
                    </div>
                </div>
            </div>

            {/* Cancel confirmation */}
            <Modal
                open={isCancelling}
                onClose={closeCancelDialog}
                title="Cancel this order?"
                description={`Order ${order.orderId} will be cancelled and removed from the processing queue. This can't be undone.`}
                size="sm"
                dismissible={!cancelLoading}
                footer={
                    <>
                        <Button onClick={closeCancelDialog} disabled={cancelLoading}>
                            Keep order
                        </Button>
                        <Button variant="danger" icon={Ban} onClick={handleCancelOrder} loading={cancelLoading}>
                            Cancel order
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-fg-secondary">
                    The patient will need a new order if testing is still required.
                </p>
                {cancelError && (
                    <p
                        role="alert"
                        className="mt-3 flex items-start gap-2 rounded-md border border-status-danger-edge bg-status-danger-bg p-3 text-xs text-status-danger-fg"
                    >
                        <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{cancelError}</span>
                    </p>
                )}
            </Modal>
        </div>
    );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function DetailItem({ label, value, mono, className }: { label: string; value: ReactNode; mono?: boolean; className?: string }) {
    return (
        <div className={className}>
            <dt className="text-xs text-fg-muted">{label}</dt>
            <dd className={mono ? 'truncate font-mono text-xs font-medium text-fg' : 'truncate font-medium text-fg'}>{value}</dd>
        </div>
    );
}

const STEP_ICON: Record<OrderTrackingStatus, { icon: LucideIcon; className: string; box: string }> = {
    COMPLETED: { icon: Check, className: 'text-status-verified-fg', box: 'border-status-verified-edge bg-status-verified-bg' },
    CURRENT: { icon: CircleDot, className: 'text-primary-strong', box: 'border-primary/25 bg-primary-soft' },
    FAILED: { icon: X, className: 'text-status-danger-fg', box: 'border-status-danger-edge bg-status-danger-bg' },
    PENDING: { icon: Circle, className: 'text-fg-faint', box: 'border-edge bg-surface' },
};

function TrackingStepItem({ step }: { step: OrderTrackingStep }) {
    const s = STEP_ICON[step.status] ?? STEP_ICON.PENDING;
    const Icon = s.icon;
    const isCurrent = step.status === 'CURRENT';
    return (
        <li className={`min-w-0 rounded-md border p-2.5 ${s.box}`} aria-current={isCurrent ? 'step' : undefined}>
            <div className="flex items-center justify-between gap-2">
                <Icon className={`h-4 w-4 shrink-0 ${s.className}`} aria-hidden="true" />
                <StatusChip size="sm" tone={TRACKING_TONE[step.status] ?? 'neutral'}>
                    {humanizeStatus(step.status)}
                </StatusChip>
            </div>
            <p className="mt-2 text-xs font-medium leading-tight text-fg">{step.label}</p>
            {step.description && (
                <p className="mt-0.5 truncate text-[12px] text-fg-muted" title={step.description}>
                    {step.description}
                </p>
            )}
            <p className="mt-1 text-[12px] tabular-nums text-fg-muted">{formatTrackingTime(step.timestamp)}</p>
        </li>
    );
}

function TrackingEventItem({ event }: { event: OrderTrackingEvent }) {
    return (
        <li className="relative pb-4 last:pb-0">
            {/* Neutral timeline dot; the status chip carries the meaning */}
            <span
                aria-hidden="true"
                className="absolute -left-[29px] top-4 h-2.5 w-2.5 rounded-full bg-fg-faint ring-4 ring-surface"
            />
            <div className="rounded-md border border-edge bg-surface p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="min-w-0 break-words text-sm font-medium text-fg">{event.title}</h3>
                            {event.stage && (
                                <StatusChip size="sm" tone="neutral">
                                    {humanizeStatus(event.stage)}
                                </StatusChip>
                            )}
                            <StatusChip size="sm" tone={TRACKING_TONE[event.status] ?? 'neutral'}>
                                {humanizeStatus(event.status)}
                            </StatusChip>
                        </div>
                        {event.description && <p className="mt-1 break-words text-xs text-fg-muted">{event.description}</p>}
                    </div>
                    <p className="shrink-0 text-xs tabular-nums text-fg-muted">{formatTrackingTime(event.timestamp)}</p>
                </div>

                {(event.testName || event.barcode || event.performedBy || event.method || event.trackingNumber || event.trackingUrl) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] text-fg-secondary">
                        {event.testName && <TrackingMeta icon={FlaskConical} value={event.testName} />}
                        {event.barcode && <TrackingMeta icon={QrCode} value={event.barcode} mono />}
                        {event.performedBy && <TrackingMeta icon={User} value={event.performedBy} />}
                        {event.method && <TrackingMeta icon={Truck} value={event.method} />}
                        {event.trackingNumber && <TrackingMeta icon={Hash} value={event.trackingNumber} mono />}
                        {event.trackingUrl && (
                            <a
                                href={event.trackingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                            >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                Track post
                                <span className="sr-only"> (opens in a new tab)</span>
                            </a>
                        )}
                    </div>
                )}
            </div>
        </li>
    );
}

function TrackingMeta({ icon: Icon, value, mono }: { icon: LucideIcon; value: string; mono?: boolean }) {
    return (
        <span
            title={value}
            className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5 ring-1 ring-inset ring-edge ${mono ? 'font-mono' : ''}`}
        >
            <Icon className="h-3.5 w-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
            <span className="truncate">{value}</span>
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

    return parsed.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}
