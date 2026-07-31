'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { TestOrder } from '@/types/orders-billing';
import { formatCurrency, getOrderStatusColor, formatDate } from '@/constants/orders-billing';
import { getOrders } from '@/lib/api';

type StatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
const PAGE_SIZE = 5;

export default function AllOrdersPage() {
    const router = useRouter();

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

    // ── Loading State ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-slate-300 animate-spin">progress_activity</span>
                <p className="text-sm text-slate-400 font-medium">Loading orders...</p>
            </div>
        );
    }

    // ── Error State ────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-red-300">error_outline</span>
                <h2 className="text-xl font-bold text-slate-700">Failed to Load Orders</h2>
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
                    <h1 className="text-2xl font-bold text-slate-800">All Test Orders</h1>
                    <p className="text-sm text-slate-500 mt-1">View and manage all laboratory test orders</p>
                </div>
                <button
                    onClick={() => router.push('/orders-billing/create-order')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm"
                >
                    <span className="material-icons text-lg">add</span>
                    Create New Order
                </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                {[
                    { label: 'Total Orders', value: stats.total, icon: 'science', color: 'blue' },
                    { label: 'Pending', value: stats.pending, icon: 'schedule', color: 'amber' },
                    { label: 'In Progress', value: stats.inProgress, icon: 'autorenew', color: 'orange' },
                    { label: 'Completed', value: stats.completed, icon: 'check_circle', color: 'emerald' },
                ].map((s) => (
                    <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`w-10 h-10 rounded-xl bg-${s.color}-100 flex items-center justify-center`}>
                                <span className={`material-icons text-${s.color}-600`}>{s.icon}</span>
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                        <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="relative flex-1">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Search by Order ID, Patient Name, Patient ID..."
                            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="material-icons text-lg text-slate-400">filter_list</span>
                        <select
                            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            value={statusFilter}
                            onChange={(e) => handleStatus(e.target.value as StatusFilter)}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 mb-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <th className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">Order ID</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Patient ID</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Patient</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Date</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Tests</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Total</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Status</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-slate-400">
                                        {orders.length === 0
                                            ? 'No orders available.'
                                            : 'No orders found matching your search.'}
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((order) => (
                                    <tr key={order.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-3 font-semibold text-primary">{order.orderId}</td>
                                        <td className="px-4 py-3 text-slate-500">{order.patientId}</td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-slate-700">{order.patientName}</p>
                                            <p className="text-xs text-slate-400">{order.patientAge}Y • {order.patientGender}</p>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">{formatDate(order.orderDate)}</td>
                                        <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                                            {(order.tests ?? []).map(t => t.testName).join(', ')}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-slate-700">{formatCurrency(order.totalAmount)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${getOrderStatusColor(order.status)}`}>
                                                {order.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => router.push(`/orders-billing/orders/${order.id}`)}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                                title="View Order"
                                            >
                                                <span className="material-icons text-lg text-primary">visibility</span>
                                            </button>
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
                    Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{' '}
                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} entries
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