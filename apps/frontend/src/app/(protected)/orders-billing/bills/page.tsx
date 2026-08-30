'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
    AlertTriangle,
    CalendarRange,
    Eye,
    FileSpreadsheet,
    Receipt,
    RefreshCw,
    Search,
    Wallet,
    X,
} from 'lucide-react';
import type { Bill } from '@/types/orders-billing';
import { formatCurrency, formatDateTime } from '@/constants/orders-billing';
import { getOrdersBillingStats, getOrders, getBillByOrderId } from '@/lib/api';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { InputField } from '@/components/ui/Field';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip from '@/components/ui/StatusChip';
import Pagination from '@/components/ui/Pagination';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatRegistered } from '@/components/patient-dashboard/dashboard-data';

const PAGE_SIZE = 4;
const SKELETON_ROWS = 4;

/** Latest payment timestamp on a bill, falling back to the bill date. */
const getBillDateTime = (bill: any): string => {
    return bill.payments && bill.payments.length > 0
        ? bill.payments[bill.payments.length - 1].date ||
        bill.payments[bill.payments.length - 1].paymentDate ||
        bill.payments[bill.payments.length - 1].createdAt ||
        bill.billDate
        : bill.billDate;
};

/** "16 Aug 2026" for the applied date-range chip (yyyy-mm-dd input values). */
function formatDayLabel(value: string): string {
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BillsPaymentsPage() {
    const router = useRouter();

    const [bills, setBills] = useState<Bill[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [appliedDateFrom, setAppliedDateFrom] = useState('');
    const [appliedDateTo, setAppliedDateTo] = useState('');

    // WHY: No dedicated bills list endpoint — bills are fetched per order
    // since each order has exactly one bill linked to it
    useEffect(() => {
        const fetchBills = async () => {
            try {
                setLoading(true);
                setError(null);

                const ordersData = await getOrders(0, 50);
                const ordersList = ordersData?.content ?? [];

                const billPromises = ordersList.map(async (order: any) => {
                    try {
                        const bill = await getBillByOrderId(order.id);
                        return bill;
                    } catch {
                        return null;
                    }
                });

                const billResults = await Promise.all(billPromises);
                const validBills = billResults.filter(b => b && b.paymentStatus === 'PAID');
                setBills(validBills as Bill[]);

            } catch (err: any) {
                setError(err?.message || 'Failed to load bills.');
            } finally {
                setLoading(false);
            }
        };

        fetchBills();
    }, []);

    // WHY: Stats provide financial summary for the billing dashboard header
    useEffect(() => {
        const fetchStats = async () => {
            try {
                setStatsLoading(true);
                const data = await getOrdersBillingStats();
                setStats(data);
            } catch {
                // non-critical — fail silently
            } finally {
                setStatsLoading(false);
            }
        };
        fetchStats();
    }, []);

    const handleApplyDateFilter = () => {
        setAppliedDateFrom(dateFrom);
        setAppliedDateTo(dateTo);
        setCurrentPage(1);
    };

    const handleResetDateFilter = () => {
        setDateFrom('');
        setDateTo('');
        setAppliedDateFrom('');
        setAppliedDateTo('');
        setCurrentPage(1);
    };

    const filtered = useMemo(() => {
        return bills.filter((b) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch =
                !q ||
                b.billId?.toLowerCase().includes(q) ||
                b.patientName?.toLowerCase().includes(q) ||
                b.patientId?.toLowerCase().includes(q);
            const matchesStatus = true;
            const billDate = new Date(getBillDateTime(b));
            const matchesFrom =
                !appliedDateFrom || billDate >= new Date(appliedDateFrom);
            const matchesTo =
                !appliedDateTo || billDate <= new Date(appliedDateTo);
            return matchesSearch && matchesStatus && matchesFrom && matchesTo;
        });
    }, [bills, searchQuery, statusFilter, appliedDateFrom, appliedDateTo]);

    const handleExport = () => {
        const exportData = filtered.map((b) => {
            const dateObj = new Date(getBillDateTime(b));
            return {
                billId: b.billId,
                orderId: b.orderId,
                patientId: b.patientId,
                patientName: b.patientName,
                date: dateObj.toLocaleDateString(),
                time: dateObj.toLocaleTimeString(),
                totalAmount: b.totalAmount,
            };
        });

        const headers = ["Bill ID", "Order ID", "Patient ID", "Patient Name", "Date", "Time", "Total Amount"];
        const rows = exportData.map((row) => [
            row.billId,
            row.orderId,
            row.patientId,
            row.patientName,
            row.date,
            row.time,
            row.totalAmount,
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const colWidths = headers.map((h, i) => ({
            wch: Math.min(Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)) + 2, 50),
        }));
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Bills');
        XLSX.writeFile(workbook, `bills_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const totalCollected = bills.reduce(
        (s, b) => s + (b.paidAmount ?? 0), 0);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    const handleSearch = (v: string) => {
        setSearchQuery(v);
        setCurrentPage(1);
    };
    const handleStatus = (v: string) => {
        setStatusFilter(v);
        setCurrentPage(1);
    };

    const hasDateFilter = Boolean(appliedDateFrom || appliedDateTo);
    const hasFilters = Boolean(searchQuery || hasDateFilter);
    const appliedRangeLabel =
        appliedDateFrom && appliedDateTo
            ? `${formatDayLabel(appliedDateFrom)} – ${formatDayLabel(appliedDateTo)}`
            : appliedDateFrom
                ? `From ${formatDayLabel(appliedDateFrom)}`
                : `Until ${formatDayLabel(appliedDateTo)}`;

    const clearAllFilters = () => {
        setSearchQuery('');
        handleResetDateFilter();
    };

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Bills and payments"
                crumbs={[
                    { label: 'Dashboard', href: '/dashboard' },
                    { label: 'Orders and billing', href: '/orders-billing' },
                    { label: 'Bills' },
                ]}
                meta={
                    <>
                        <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Paid bills and recorded payments</span>
                        {!loading && !error && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {bills.length} {bills.length === 1 ? 'bill' : 'bills'}
                                </span>
                            </>
                        )}
                    </>
                }
                actions={
                    <>
                        <Button icon={FileSpreadsheet} onClick={handleExport} disabled={loading}>
                            Export to Excel
                        </Button>
                        <Button variant="primary" icon={Wallet} onClick={() => router.push('/orders-billing/payments/new')}>
                            Record payment
                        </Button>
                    </>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading bills'
                    : error
                        ? 'Bills failed to load'
                        : `Bills loaded. Showing ${paginated.length} of ${filtered.length} bills${
                            totalPages > 1 ? `, page ${currentPage} of ${totalPages}` : ''
                        }.`}
            </p>

            {/* Stats */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatCard
                    label="Paid bills"
                    value={bills.length}
                    icon={Receipt}
                    sub="Bills with a recorded payment"
                    loading={statsLoading || loading}
                />
                <StatCard
                    label="Total collected"
                    value={formatCurrency(totalCollected)}
                    icon={Wallet}
                    sub="Sum of amounts paid"
                    loading={statsLoading || loading}
                />
            </div>

            <SectionCard title="Bills" count={!loading && !error ? filtered.length : undefined} flush>
                {/* Filter toolbar */}
                <div className="flex flex-col gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <InputField
                            label="Search bills"
                            hideLabel
                            type="search"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Search bill ID, patient name or patient ID"
                            autoComplete="off"
                            className="min-w-[200px] flex-1"
                        />
                        {hasFilters && (
                            <Button variant="ghost" icon={X} onClick={clearAllFilters}>
                                Clear filters
                            </Button>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-fg-muted">
                            <CalendarRange className="h-4 w-4" aria-hidden="true" />
                            Date range
                        </span>
                        <InputField
                            label="From date"
                            hideLabel
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full sm:w-44"
                        />
                        <span className="text-xs text-fg-muted" aria-hidden="true">
                            to
                        </span>
                        <InputField
                            label="To date"
                            hideLabel
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full sm:w-44"
                        />
                        <Button onClick={handleApplyDateFilter}>Apply dates</Button>
                        {hasDateFilter && (
                            <>
                                <Button variant="ghost" icon={X} onClick={handleResetDateFilter}>
                                    Reset dates
                                </Button>
                                <StatusChip tone="info">{appliedRangeLabel}</StatusChip>
                            </>
                        )}
                    </div>
                </div>

                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-24 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton md:block" />
                                <span className="hidden h-3 w-20 rounded bg-skeleton lg:block" />
                                <span className="h-3 w-1/4 rounded bg-skeleton" />
                                <span className="h-3 w-24 rounded bg-skeleton" />
                                <span className="h-4 w-12 rounded bg-skeleton" />
                                <span className="ml-auto h-3 w-24 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load bills"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => window.location.reload()}>
                                Retry
                            </Button>
                        }
                    />
                ) : paginated.length === 0 ? (
                    bills.length === 0 ? (
                        <EmptyState
                            icon={Receipt}
                            title="No paid bills yet"
                            description="Bills appear here once a payment has been recorded against an order."
                            action={
                                <Button size="sm" icon={Wallet} onClick={() => router.push('/orders-billing/payments/new')}>
                                    Record payment
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Search}
                            title="No bills match"
                            description="Try a different search term or date range."
                            action={
                                <Button size="sm" icon={X} onClick={clearAllFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        {/*
                          table-fixed column budget. Always-on fixed widths: Bill ID 144 + Paid on 144
                          + Status 96 + Total 144 + Actions 48 = 576. "Patient" is the only auto column and
                          needs >= 160px to show a name, so min-w must clear fixed-sum + 160 in EVERY band:
                            base (<md):                576             -> min-w 740    (Patient 164)
                            md   (+ Order ID 144):     720 + 160 = 880 -> md:min-w 880 (Patient 160)
                            lg   (+ Patient ID 128):   848 + 160 = 1008 -> lg:min-w 1010 (Patient 162)
                          At the old flat min-w 720 the fixed columns met the table width exactly at md
                          (Patient 0px) and overran it at lg, so the patient name vanished.
                          The card's overflow-x-auto scrolls the surplus; the page never does.
                        */}
                        <table className="w-full min-w-[740px] table-fixed text-left text-sm md:min-w-[880px] lg:min-w-[1010px]">
                            <caption className="sr-only">Paid bills</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-36 py-2 pl-4 pr-3 font-semibold">
                                        Bill ID
                                    </th>
                                    <th scope="col" className="hidden w-36 px-3 py-2 font-semibold md:table-cell">
                                        Order ID
                                    </th>
                                    <th scope="col" className="hidden w-32 px-3 py-2 font-semibold lg:table-cell">
                                        Patient ID
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-semibold">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-36 px-3 py-2 font-semibold">
                                        Paid on
                                    </th>
                                    <th scope="col" className="w-24 px-3 py-2 font-semibold">
                                        Status
                                    </th>
                                    <th scope="col" className="w-36 px-3 py-2 text-right font-semibold">
                                        Total
                                    </th>
                                    <th scope="col" className="w-12 py-2 pl-2 pr-3">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {paginated.map((bill) => {
                                    const paidAtRaw = getBillDateTime(bill);
                                    const paidAt = new Date(paidAtRaw);
                                    const paidAtValid = !Number.isNaN(paidAt.getTime());
                                    return (
                                        <tr key={bill.id} className="transition-colors hover:bg-surface-hover">
                                            <td className="py-2 pl-4 pr-3 font-mono text-xs">
                                                <Link
                                                    href={`/orders-billing/bills/${bill.id}`}
                                                    title={bill.billId || undefined}
                                                    className="inline-block max-w-full truncate rounded align-middle font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                                >
                                                    {bill.billId}
                                                </Link>
                                            </td>
                                            <td className="hidden truncate px-3 py-2 font-mono text-xs text-fg-muted md:table-cell" title={bill.orderId || undefined}>
                                                {bill.orderId || '—'}
                                            </td>
                                            <td className="hidden truncate px-3 py-2 font-mono text-xs text-fg-muted lg:table-cell" title={bill.patientId || undefined}>
                                                {bill.patientId || '—'}
                                            </td>
                                            <td className="truncate px-3 py-2 font-medium text-fg" title={bill.patientName || undefined}>
                                                {bill.patientName || '—'}
                                            </td>
                                            <td className="px-3 py-2 tabular-nums text-fg-secondary">
                                                {paidAtValid ? (
                                                    <time dateTime={paidAt.toISOString()} title={formatDateTime(paidAtRaw)}>
                                                        {formatRegistered(paidAt)}
                                                    </time>
                                                ) : (
                                                    <span className="text-fg-faint">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusBadge status={bill.paymentStatus} />
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium tabular-nums text-fg">
                                                {formatCurrency(bill.totalAmount)}
                                            </td>
                                            <td className="py-2 pl-2 pr-3 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    icon={Eye}
                                                    aria-label={`View bill ${bill.billId}`}
                                                    title="View bill"
                                                    onClick={() => router.push(`/orders-billing/bills/${bill.id}`)}
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
                        itemLabel="bills"
                    />
                )}
            </SectionCard>
        </div>
    );
}
