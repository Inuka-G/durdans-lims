"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
    listDeliveryRecords,
    type DeliveryRecordRow,
    type ApiDeliveryMethod,
} from "@/lib/api";

const ITEMS_PER_PAGE = 10;

const methodIcons: Record<ApiDeliveryMethod, { icon: string; color: string; bg: string }> = {
    EMAIL: { icon: "mail", color: "text-blue-700", bg: "bg-blue-50" },
    SMS: { icon: "smartphone", color: "text-amber-700", bg: "bg-amber-50" },
    WHATSAPP: { icon: "chat", color: "text-green-700", bg: "bg-green-50" },
    POST: { icon: "local_shipping", color: "text-indigo-700", bg: "bg-indigo-50" },
    PRINT: { icon: "print", color: "text-emerald-700", bg: "bg-emerald-50" },
    PORTAL: { icon: "language", color: "text-purple-700", bg: "bg-purple-50" },
};

const deliveryBuckets = [
    { label: "12A", start: 0, end: 4 },
    { label: "4A", start: 4, end: 8 },
    { label: "8A", start: 8, end: 12 },
    { label: "12P", start: 12, end: 16 },
    { label: "4P", start: 16, end: 20 },
    { label: "8P", start: 20, end: 24 },
];

const parseHourFromDisplayTime = (value?: string | null) => {
    if (!value) return null;
    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;

    let hour = Number(match[1]);
    const period = match[3].toUpperCase();
    if (period === "PM" && hour < 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    return Number.isFinite(hour) ? hour : null;
};

export default function DeliveryStatusPage() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [rows, setRows] = useState<DeliveryRecordRow[]>([]);
    const [overview, setOverview] = useState<DeliveryRecordRow[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadOverview = useCallback(async () => {
        try {
            const res = await listDeliveryRecords({ page: 0, size: 500, sort: "authorizedAt,desc" });
            setOverview(res.content);
        } catch {
            /* ignore */
        }
    }, []);

    const loadTable = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params: Record<string, unknown> = {
                page: currentPage - 1,
                size: ITEMS_PER_PAGE,
                sort: "authorizedAt,desc",
            };
            if (statusFilter !== "All") params.status = statusFilter;
            if (search.trim()) params.keyword = search.trim();
            const res = await listDeliveryRecords(params);
            setRows(res.content);
            setTotalPages(Math.max(1, res.totalPages));
            setTotalElements(res.totalElements);
        } catch (e) {
            console.error(e);
            setError("Could not load delivery records.");
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, statusFilter, search]);

    useEffect(() => { void loadOverview(); }, [loadOverview]);
    useEffect(() => { void loadTable(); }, [loadTable]);

    const tabCounts = useMemo(() => {
        const list = overview;
        return {
            All: list.length,
            DELIVERED: list.filter((r) => r.status === "DELIVERED").length,
            PENDING: list.filter((r) => r.status === "PENDING" || r.status === "PARTIAL").length,
            FAILED: list.filter((r) => r.status === "FAILED").length,
        } as Record<"All" | "DELIVERED" | "PENDING" | "FAILED", number>;
    }, [overview]);

    const deliveredCount = tabCounts.DELIVERED;
    const pendingCount = tabCounts.PENDING;
    const failedCount = tabCounts.FAILED;
    const deliveryTrend = useMemo(() => {
        const counts = deliveryBuckets.map((bucket) => ({
            ...bucket,
            count: overview.filter((record) => {
                const hour = parseHourFromDisplayTime(record.dispatchedTime);
                return hour != null && hour >= bucket.start && hour < bucket.end;
            }).length,
        }));
        const max = Math.max(1, ...counts.map((bucket) => bucket.count));
        return counts.map((bucket) => ({
            ...bucket,
            height: `${Math.max(8, Math.round((bucket.count / max) * 100))}%`,
        }));
    }, [overview]);

    const handleExportAuditLog = () => {
        const data = rows.length ? rows : overview;
        const headers = ["Report ID", "Patient", "Test", "Methods", "Status", "Dispatched", "Delivered", "Tracking"];
        const exportRows = data.map((r) => [
            r.reportId,
            r.patientName,
            r.testName,
            r.methods.join(", "),
            r.status,
            r.dispatchedTime,
            r.deliveredTime ?? "—",
            r.trackingNumber ?? "",
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
        const colWidths = headers.map((h, i) => ({
            wch: Math.min(Math.max(h.length, ...exportRows.map((r) => String(r[i] ?? "").length)) + 2, 50),
        }));
        worksheet["!cols"] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Delivery Audit Log");
        const date = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `delivery_audit_log_${date}.xlsx`);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "DELIVERED":
                return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">DELIVERED</span>;
            case "FAILED":
                return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">FAILED</span>;
            case "PARTIAL":
                return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">PARTIAL</span>;
            default:
                return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">PENDING</span>;
        }
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Delivery Status</h1>
                    <p className="text-sm text-slate-500 mt-1">Track and monitor report delivery across all channels.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-auto">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Search Report ID or Patient..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-64"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleExportAuditLog}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold border border-emerald-200 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors w-full sm:w-auto"
                    >
                        <span className="material-icons text-[18px]">table_view</span>
                        Export Excel
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{error}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <span className="material-icons text-emerald-600">check_circle</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{deliveredCount}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-semibold text-slate-600">Delivered</p>
                        <span className="text-[11px] text-emerald-500 font-medium">Successfully sent</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <span className="material-icons text-amber-600">schedule</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{pendingCount}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-semibold text-slate-600">Pending / Partial</p>
                        <span className="text-[11px] text-amber-500 font-medium">Awaiting delivery</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                            <span className="material-icons text-red-600">cancel</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{failedCount}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-semibold text-slate-600">Failed</p>
                        <span className="text-[11px] text-red-500 font-medium">Require attention</span>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 mb-8 relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-1">Delivery Trend Today</h3>
                        <p className="text-xs text-slate-500">Grouped from real dispatch records</p>
                    </div>
                </div>
                <div className="h-36 grid grid-cols-6 items-end gap-3 border border-slate-100 rounded-xl bg-slate-50/40 px-4 py-3">
                    {deliveryTrend.map((bucket) => (
                        <div key={bucket.label} className="flex h-full flex-col justify-end gap-2">
                            <div className="flex flex-1 items-end justify-center">
                                <div
                                    className="w-full max-w-8 rounded-t-lg bg-primary/80"
                                    style={{ height: bucket.height }}
                                    title={`${bucket.count} delivery record(s)`}
                                />
                            </div>
                            <div className="text-center text-[11px] font-semibold text-slate-500">{bucket.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-b border-slate-100 bg-slate-50/30 gap-4">
                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                        {(["All", "DELIVERED", "PENDING", "FAILED"] as const).map((status) => (
                            <button
                                type="button"
                                key={status}
                                onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${statusFilter === status ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                            >
                                {status}
                                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusFilter === status ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                                    {tabCounts[status]}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/50 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <th className="px-6 py-4 border-b border-slate-100">Report ID</th>
                                <th className="px-4 py-4 border-b border-slate-100">Patient</th>
                                <th className="px-4 py-4 border-b border-slate-100">Test</th>
                                <th className="px-4 py-4 border-b border-slate-100">Methods</th>
                                <th className="px-4 py-4 border-b border-slate-100">Status</th>
                                <th className="px-4 py-4 border-b border-slate-100">Dispatched</th>
                                <th className="px-4 py-4 border-b border-slate-100">Delivered</th>
                                <th className="px-4 py-4 border-b border-slate-100">Tracking</th>
                                <th className="px-6 py-4 border-b border-slate-100 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-16 text-slate-400 text-sm">Loading...</td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-16 text-slate-400 text-sm">
                                        No delivery records found.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((record) => (
                                    <tr
                                        key={record.reportId + record.dispatchedTime}
                                        className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors ${record.status === "FAILED" ? "bg-red-50/30" : "bg-white"}`}
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-[13px] font-bold text-slate-700">{record.reportId}</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="text-sm font-bold text-slate-800">{record.patientName}</div>
                                        </td>
                                        <td className="px-4 py-4 text-[13px] text-slate-600 font-medium">{record.testName}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex gap-1.5">
                                                {record.methods.map((method) => {
                                                    const m = methodIcons[method];
                                                    if (!m) return null;
                                                    return (
                                                        <div
                                                            key={method}
                                                            title={method}
                                                            className={`w-6 h-6 rounded-md ${m.bg} flex items-center justify-center border border-white/50`}
                                                        >
                                                            <span className={`material-icons text-[12px] ${m.color}`}>{m.icon}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">{getStatusBadge(record.status)}</td>
                                        <td className="px-4 py-4 text-xs font-semibold text-slate-600">{record.dispatchedTime}</td>
                                        <td className={`px-4 py-4 text-xs font-semibold ${record.deliveredTime ? "text-emerald-600" : "text-slate-400"}`}>
                                            {record.deliveredTime ?? "—"}
                                        </td>
                                        <td className="px-4 py-4 text-xs font-semibold text-slate-600">
                                            {record.trackingNumber ? (
                                                record.trackingUrl ? (
                                                    <a href={record.trackingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                                        {record.trackingNumber}
                                                    </a>
                                                ) : record.trackingNumber
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {record.status === "FAILED" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => router.push("/dispatch/failed-deliveries")}
                                                    className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm shadow-red-600/30"
                                                >
                                                    Retry
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => router.push(`/dispatch/authorized-reports/${encodeURIComponent(record.reportId)}`)}
                                                    className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                                                >
                                                    View
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                    <span className="text-sm text-slate-500">
                        Showing{" "}
                        <strong>
                            {totalElements === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–
                            {Math.min(currentPage * ITEMS_PER_PAGE, totalElements)}
                        </strong>{" "}
                        of <strong>{totalElements}</strong> records
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => p - 1)}
                            disabled={currentPage === 1}
                            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <span className="material-icons text-[18px]">chevron_left</span>
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                type="button"
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-bold transition-colors ${page === currentPage ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => p + 1)}
                            disabled={currentPage === totalPages}
                            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <span className="material-icons text-[18px]">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
