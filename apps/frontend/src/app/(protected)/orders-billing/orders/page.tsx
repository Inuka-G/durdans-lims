'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    ClipboardList,
    Clock,
    Eye,
    Plus,
    RefreshCw,
    SearchX,
    X,
} from 'lucide-react';
import type { TestOrder } from '@/types/orders-billing';
import { formatCurrency } from '@/constants/orders-billing';
import { getOrders } from '@/lib/api';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { InputField } from '@/components/ui/Field';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Pagination from '@/components/ui/Pagination';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatRegistered } from '@/components/patient-dashboard/dashboard-data';

type StatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
const PAGE_SIZE = 5;
const SKELETON_ROWS = 5;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'IN_PROGRESS', label: 'In progress' },
    { value: 'COMPLETED', label: 'Completed' },
];

function toDate(value?: string | null): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export default function AllOrdersPage() {
    // ── Data State ─────────────────────────────────────────────────────────────
    const [orders, setOrders] = useState<TestOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Filter State ───────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [currentPage, setCurrentPage] = useState(1);

    // ── Fetch Orders ───────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setLoading(true);
                setError(null);
                // Fetch a large page to support client-side filtering
                const data = await getOrders(0, 100);
                const list = data?.content ?? data ?? [];
                const normalizedOrders = (Array.isArray(list) ? list : []).map((order: any) => {
                    const subtotal = (order.tests ?? []).reduce((sum: number, t: any) => sum + (t.price ?? 0), 0);
                    const serviceCharge = subtotal * 0.05;
                    return {
                        ...order,
                        totalAmount: subtotal + serviceCharge,
                    };
                });
                setOrders(normalizedOrders);
            } catch (err: any) {
                setError(err?.message || 'Failed to load orders.');
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    // ── Stats ──────────────────────────────────────────────────────────────────
    const stats = {
        total: orders.filter(o => o.status !== 'CANCELLED').length,
        pending: orders.filter(o => o.status === 'PENDING').length,
        inProgress: orders.filter(o => o.status === 'IN_PROGRESS').length,
        completed: orders.filter(o => o.status === 'COMPLETED').length,
    };

    // ── Client-side Filtering ──────────────────────────────────────────────────
    const filtered = useMemo(() => {
        return orders.filter((o) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch =
                !q ||
                o.orderId?.toLowerCase().includes(q) ||
                o.patientName?.toLowerCase().includes(q) ||
                o.patientId?.toLowerCase().includes(q);
            const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [orders, searchQuery, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const handleSearch = (v: string) => { setSearchQuery(v); setCurrentPage(1); };
    const handleStatus = (v: StatusFilter) => { setStatusFilter(v); setCurrentPage(1); };
    const hasFilters = Boolean(searchQuery) || statusFilter !== 'ALL';
    const clearFilters = () => { setSearchQuery(''); setStatusFilter('ALL'); setCurrentPage(1); };

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Orders"
                crumbs={[
                    { label: 'Dashboard', href: '/dashboard' },
                    { label: 'Orders & billing', href: '/orders-billing' },
                    { label: 'Orders' },
                ]}
                meta={
                    <>
                        <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>All laboratory test orders</span>
                        {!loading && !error && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {orders.length.toLocaleString()} {orders.length === 1 ? 'order' : 'orders'}
                                </span>
                            </>
                        )}
                    </>
                }
                actions={
                    <Button variant="primary" icon={Plus} href="/orders-billing/create-order">
                        Create order
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading orders'
                    : error
                      ? 'Orders failed to load'
                      : `Orders loaded. Showing ${paginated.length} of ${filtered.length} orders${
                            totalPages > 1 ? `, page ${currentPage} of ${totalPages}` : ''
                        }.`}
            </p>

            {/* Stat tiles */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total orders" value={error ? '—' : stats.total} icon={ClipboardList} color="blue" loading={loading} />
                <StatCard label="Pending" value={error ? '—' : stats.pending} icon={Clock} color="orange" loading={loading} />
                <StatCard label="In progress" value={error ? '—' : stats.inProgress} icon={Activity} color="orange" loading={loading} />
                <StatCard label="Completed" value={error ? '—' : stats.completed} icon={CheckCircle2} color="emerald" loading={loading} />
            </div>

            <SectionCard title="Orders" count={!loading && !error ? filtered.length : undefined} flush>
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <InputField
                        label="Search orders"
                        hideLabel
                        type="search"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Search order ID, patient name or patient ID"
                        autoComplete="off"
                        className="min-w-[200px] flex-1"
                    />
                    <SegmentedControl<StatusFilter>
                        ariaLabel="Filter by status"
                        value={statusFilter}
                        onChange={handleStatus}
                        options={STATUS_OPTIONS}
                    />
                    {hasFilters && (
                        <Button variant="ghost" icon={X} onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </div>

                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-24 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-20 shrink-0 rounded bg-skeleton md:block" />
                                <span className="h-4 w-32 shrink-0 rounded bg-skeleton" />
                                <span className="h-3 w-24 rounded bg-skeleton" />
                                <span className="hidden h-3 w-1/4 rounded bg-skeleton lg:block" />
                                <span className="ml-auto h-3 w-20 rounded bg-skeleton" />
                                <span className="h-4 w-16 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load orders"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => window.location.reload()}>
                                Retry
                            </Button>
                        }
                    />
                ) : paginated.length === 0 ? (
                    orders.length === 0 ? (
                        <EmptyState
                            icon={ClipboardList}
                            title="No orders yet"
                            description="Orders appear here as soon as they are created."
                            action={
                                <Button size="sm" icon={Plus} href="/orders-billing/create-order">
                                    Create order
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={SearchX}
                            title="No orders match"
                            description="Try a different search term or status."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] table-fixed text-left text-[13px] md:min-w-[860px] lg:min-w-[1060px]">
                            <caption className="sr-only">Test orders</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                    <th scope="col" className="w-32 py-2 pl-4 pr-3 font-medium">
                                        Order ID
                                    </th>
                                    <th scope="col" className="hidden w-32 px-3 py-2 font-medium md:table-cell">
                                        Patient ID
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-medium">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-32 px-3 py-2 font-medium">
                                        Date
                                    </th>
                                    <th scope="col" className="hidden w-48 px-3 py-2 font-medium lg:table-cell">
                                        Tests
                                    </th>
                                    <th scope="col" className="w-32 px-3 py-2 text-right font-medium">
                                        Total
                                    </th>
                                    <th scope="col" className="w-32 px-3 py-2 font-medium">
                                        Status
                                    </th>
                                    <th scope="col" className="w-12 py-2 pl-2 pr-3">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {paginated.map((order) => {
                                    const testNames = (order.tests ?? []).map(t => t.testName).join(', ');
                                    const orderDate = toDate(order.orderDate);
                                    return (
                                        <tr key={order.id} className="transition-colors hover:bg-surface-hover">
                                            <td className="truncate py-2 pl-4 pr-3 font-mono text-xs font-medium text-primary-strong" title={order.orderId || undefined}>
                                                {order.orderId}
                                            </td>
                                            <td className="hidden truncate px-3 py-2 font-mono text-xs text-fg-muted md:table-cell" title={order.patientId || undefined}>
                                                {order.patientId || '—'}
                                            </td>
                                            <td className="min-w-0 px-3 py-2">
                                                <p className="truncate font-medium text-fg" title={order.patientName || undefined}>{order.patientName || '—'}</p>
                                                <p className="truncate text-xs text-fg-muted">
                                                    {order.patientAge != null ? `${order.patientAge}y` : '—'}
                                                    <span aria-hidden="true"> · </span>
                                                    {order.patientGender || '—'}
                                                </p>
                                            </td>
                                            <td className="px-3 py-2 tabular-nums text-fg-secondary">
                                                {orderDate ? (
                                                    <time dateTime={orderDate.toISOString()}>{formatRegistered(orderDate)}</time>
                                                ) : (
                                                    <span className="text-fg-faint">—</span>
                                                )}
                                            </td>
                                            <td className="hidden truncate px-3 py-2 text-fg-muted lg:table-cell" title={testNames || undefined}>
                                                {testNames || <span className="text-fg-faint">—</span>}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium tabular-nums text-fg">
                                                {formatCurrency(order.totalAmount)}
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusBadge status={order.status} />
                                            </td>
                                            <td className="py-2 pl-2 pr-3 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    icon={Eye}
                                                    href={`/orders-billing/orders/${order.id}`}
                                                    aria-label={`View order ${order.orderId}`}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer: paging */}
                {!loading && !error && filtered.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filtered.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={setCurrentPage}
                        itemLabel="orders"
                    />
                )}
            </SectionCard>
        </div>
    );
}
