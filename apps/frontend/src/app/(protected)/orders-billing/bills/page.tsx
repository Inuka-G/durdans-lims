'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Bill } from '@/types/orders-billing';
import { formatCurrency, PAYMENT_STATUS_COLORS, formatDate, formatDateTime } from '@/constants/orders-billing';
import { getOrdersBillingStats, getOrders, getBillByOrderId } from '@/lib/api';

const PAGE_SIZE = 4;

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
            const pDate = b.payments && b.payments.length > 0
                ? b.payments[b.payments.length - 1].date || (b.payments[b.payments.length - 1] as any).paymentDate || (b.payments[b.payments.length - 1] as any).createdAt || b.billDate
                : b.billDate;
            const billDate = new Date(pDate as unknown as string);
            const matchesFrom =
                !appliedDateFrom || billDate >= new Date(appliedDateFrom);
            const matchesTo =
                !appliedDateTo || billDate <= new Date(appliedDateTo);
            return matchesSearch && matchesStatus && matchesFrom && matchesTo;
        });
    }, [bills, searchQuery, statusFilter, appliedDateFrom, appliedDateTo]);

    const getBillDateTime = (bill: any) => {
        return bill.payments && bill.payments.length > 0
            ? bill.payments[bill.payments.length - 1].date ||
            bill.payments[bill.payments.length - 1].paymentDate ||
            bill.payments[bill.payments.length - 1].createdAt ||
            bill.billDate
            : bill.billDate;
    };

    const handleExport = () => {
        const exportData = filtered.map((b) => {
            const dateObj = new Date(getBillDateTime(b));

            return {
                billId: b.billId,
                orderId: b.orderId,
                patientId: b.patientId,
                patientName: b.patientName,
                date: dateObj.toLocaleDateString(),
                time: dateObj.toLocaleTimeString(), // ✔ now correct
                totalAmount: b.totalAmount,
            };
        });

        const headers = [
            "Bill ID",
            "Order ID",
            "Patient ID",
            "Patient Name",
            "Date",
            "Time",
            "Total Amount"
        ];

        const csvRows = [
            headers.join(","),
            ...exportData.map(row =>
                [
                    row.billId,
                    row.orderId,
                    row.patientId,
                    `"${row.patientName}"`,
                    row.date,
                    row.time,
                    row.totalAmount
                ].join(",")
            )
        ];

        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `bills_export_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();

        URL.revokeObjectURL(url);
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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-slate-300 animate-spin">
                    progress_activity
                </span>
                <p className="text-sm text-slate-400 font-medium">Loading bills...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-red-300">error_outline</span>
                <h2 className="text-xl font-bold text-slate-700">Failed to Load Bills</h2>
                <p className="text-sm text-red-400">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors"
                >
                    <span className="material-icons text-base">refresh</span>
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Bills &amp; Payments</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Manage invoices and record patient payments
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.push('/orders-billing/payments/new')}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                        <span className="material-icons text-lg">payments</span>
                        Record Payment
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        <span className="material-icons text-lg">download</span>
                        Export
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-2">
                        <span className="material-icons text-blue-600">receipt_long</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                        {statsLoading ? (
                            <span className="text-slate-300 animate-pulse">—</span>
                        ) : (
                            bills.length
                        )}
                    </p>
                    <p className="text-xs text-slate-500">Total Bills</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
                        <span className="material-icons text-emerald-600">
                            account_balance_wallet
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                        {statsLoading ? (
                            <span className="text-slate-300 animate-pulse">—</span>
                        ) : (
                            formatCurrency(totalCollected)
                        )}
                    </p>
                    <p className="text-xs text-slate-500">Total Collected</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 mb-6">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <div className="relative flex-1">
                            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                                search
                            </span>
                            <input
                                type="text"
                                placeholder="Search by Bill ID, Patient Name, or Patient ID..."
                                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                        {/* Status filter removed as only PAID bills are displayed */}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center border-t border-slate-100 pt-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex-shrink-0 flex items-center gap-1.5">
                            <span className="material-icons text-sm">date_range</span>
                            Date Range
                        </span>
                        <div className="flex flex-1 items-center gap-2">
                            <input
                                type="date"
                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                            <span className="text-slate-400 text-xs font-semibold">to</span>
                            <input
                                type="date"
                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleApplyDateFilter}
                                className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors"
                            >
                                Apply Filter
                            </button>
                            {(appliedDateFrom || appliedDateTo) && (
                                <button
                                    onClick={handleResetDateFilter}
                                    className="px-3 py-2 text-sm font-semibold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-1"
                                >
                                    <span className="material-icons text-base">close</span>
                                    Reset
                                </button>
                            )}
                        </div>
                        {(appliedDateFrom || appliedDateTo) && (
                            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-lg flex-shrink-0">
                                {appliedDateFrom && appliedDateTo
                                    ? `${appliedDateFrom} → ${appliedDateTo}`
                                    : appliedDateFrom
                                        ? `From ${appliedDateFrom}`
                                        : `Until ${appliedDateTo}`}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 mb-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <th className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">Bill ID</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Order ID</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Patient ID</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Patient</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Date</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 text-right">Total</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-slate-400">
                                        {bills.length === 0
                                            ? 'No bills available.'
                                            : 'No bills found matching your search.'}
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((bill) => (
                                    <tr
                                        key={bill.id}
                                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                                    >
                                        <td className="px-5 py-3 font-semibold text-primary">
                                            {bill.billId}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">
                                            {bill.orderId}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">
                                            {bill.patientId}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-slate-700">
                                                {bill.patientName}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">
                                            {formatDateTime((bill.payments && bill.payments.length > 0
                                                ? bill.payments[bill.payments.length - 1].date || (bill.payments[bill.payments.length - 1] as any).paymentDate || (bill.payments[bill.payments.length - 1] as any).createdAt || bill.billDate
                                                : bill.billDate) as unknown as string)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                                            {formatCurrency(bill.totalAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() =>
                                                        router.push(
                                                            `/orders-billing/bills/${bill.id}`
                                                        )
                                                    }
                                                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                                    title="View Bill"
                                                >
                                                    <span className="material-icons text-lg text-primary">
                                                        visibility
                                                    </span>
                                                </button>
                                                {/* Record Payment row action removed */}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-sm text-slate-500">
                <p>
                    Showing{' '}
                    {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{' '}
                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{' '}
                    {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                        className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <span className="material-icons text-base">chevron_left</span>
                        Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${currentPage === page
                                ? 'bg-primary text-white shadow-sm'
                                : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                                }`}
                        >
                            {page}
                        </button>
                    ))}
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Next
                        <span className="material-icons text-base">chevron_right</span>
                    </button>
                </div>
            </div>
        </div>
    );
}