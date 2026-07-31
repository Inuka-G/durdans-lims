"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    listDispatchReports,
    type ApiDeliveryMethod,
    type ApiDispatchItemStatus,
    type DispatchDashboardItem,
} from "@/lib/api";
import { formatDisplayId } from "@/lib/format-id";

const ITEMS_PER_PAGE = 10;

const methodIcons: Record<ApiDeliveryMethod, { icon: string; color: string; bg: string; label: string }> = {
    EMAIL: { icon: "mail", color: "text-blue-700", bg: "bg-blue-50", label: "Email" },
    SMS: { icon: "smartphone", color: "text-amber-700", bg: "bg-amber-50", label: "SMS" },
    WHATSAPP: { icon: "chat", color: "text-green-700", bg: "bg-green-50", label: "WhatsApp" },
    POST: { icon: "local_shipping", color: "text-indigo-700", bg: "bg-indigo-50", label: "Post" },
    PRINT: { icon: "print", color: "text-emerald-700", bg: "bg-emerald-50", label: "Print" },
    PORTAL: { icon: "language", color: "text-purple-700", bg: "bg-purple-50", label: "Portal" },
};

type StatusFilter = "All" | ApiDispatchItemStatus;

const statusOptions: StatusFilter[] = ["All", "PENDING", "DELIVERED", "FAILED", "PARTIAL"];

const getHourKey = (dateValue: string, timeValue: string) => {
    const parsed = new Date(`${dateValue} ${timeValue}`);
    if (!Number.isNaN(parsed.getTime())) {
        return `${String(parsed.getHours()).padStart(2, "0")}:00`;
    }

    const match = timeValue.match(/(\d{1,2}):\d{2}\s*(AM|PM)?/i);
    if (!match) return "Other";
    let hour = Number(match[1]);
    const meridian = match[2]?.toUpperCase();
    if (meridian === "PM" && hour < 12) hour += 12;
    if (meridian === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:00`;
};

export default function DispatchDashboardPage() {
    const router = useRouter();
    const [reports, setReports] = useState<DispatchDashboardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
    const [currentPage, setCurrentPage] = useState(1);

    const loadReports = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await listDispatchReports({
                page: 0,
                size: 200,
                sort: "authorizedAt,desc",
            });
            setReports(response.content ?? []);
        } catch (loadError) {
            console.error("Failed to load dispatch reports", loadError);
            setError("Failed to load dispatch reports. Please try again.");
            setReports([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadReports();
    }, [loadReports]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return reports.filter((r) => {
            const displayReportId = formatDisplayId(r.reportId, "REP").toLowerCase();
            const matchesSearch =
                r.reportId.toLowerCase().includes(q) ||
                displayReportId.includes(q) ||
                r.patientName.toLowerCase().includes(q) ||
                r.testName.toLowerCase().includes(q);
            const matchesStatus =
                statusFilter === "All" || r.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [reports, search, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated = filtered.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const totalReports = reports.length;
    const deliveredCount = reports.filter((r) => r.status === "DELIVERED").length;
    const failedCount = reports.filter((r) => r.status === "FAILED").length;
    const pendingCount = reports.filter((r) => r.status === "PENDING" || r.status === "PARTIAL").length;

    const dispatchVolumeData = useMemo(() => {
        const counts = new Map<string, number>();
        reports.forEach((report) => {
            const key = getHourKey(report.authorizedDate, report.authorizedTime);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });

        const rows = Array.from(counts.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([time, dispatched]) => ({ time, dispatched }));

        return rows.length > 0 ? rows : [{ time: "Now", dispatched: 0 }];
    }, [reports]);

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
    }

    return (
        <div>
            {/* Page Title */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Report Dispatch Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage and track authorized laboratory report deliveries.</p>
                    {error && <p className="text-xs font-medium text-red-600 mt-1">{error}</p>}
                </div>
                <div className="relative">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                    <input
                        type="text"
                        placeholder="Search Report ID or Patient..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 w-72"
                    />
                    <button
                        type="button"
                        onClick={() => void loadReports()}
                        disabled={loading}
                        className="absolute -right-11 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 disabled:opacity-50"
                    >
                        <span className={`material-icons text-lg ${loading ? "animate-spin" : ""}`}>refresh</span>
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <span className="material-icons text-blue-600">send</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{totalReports}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-semibold text-slate-600">Total Reports</p>
                        <span className="text-[11px] text-slate-400 font-medium">Today</span>
                    </div>
                </div>

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
                        <p className="text-sm font-semibold text-slate-600">Pending</p>
                        <span className="text-[11px] text-amber-500 font-medium">Awaiting dispatch</span>
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

            {/* Charts + Delivery Methods Row */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-8">

                {/* Dispatch Volume Chart — Recharts */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-800 mb-1">Dispatch Volume Today</h3>
                    <p className="text-xs text-slate-500 mb-4">Reports dispatched per hour</p>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dispatchVolumeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '6px', fontSize: '11px', color: '#ffffff' }}
                                    formatter={(value) => [`${value} reports`, 'Dispatched']}
                                    cursor={{ fill: 'rgba(30,111,217,0.06)' }}
                                />
                                <Bar dataKey="dispatched" fill="#1E6FD9" radius={[4, 4, 0, 0]} className="hover:opacity-90" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Delivery Methods Panel */}
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-800 mb-6">Delivery Methods</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {(Object.keys(methodIcons) as ApiDeliveryMethod[]).map((method) => {
                            const m = methodIcons[method];
                            const count = reports.filter((r) =>
                                r.deliveryMethods.includes(method)
                            ).length;
                            return (
                                <div
                                    key={method}
                                    className={`p-4 rounded-xl flex flex-col gap-3 ${m.bg}`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                        <span className={`material-icons text-[16px] ${m.color}`}>{m.icon}</span>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-slate-800">{count}</div>
                                        <div className="text-xs font-semibold text-slate-500 mt-0.5">{m.label}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Reports Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">

                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-b border-slate-100 bg-slate-50/30 gap-4">
                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                        {statusOptions.map((status) => {
                            const count = status === "All" ? reports.length : reports.filter((r) => r.status === status).length;
                            return (
                                <button
                                    key={status}
                                    onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${statusFilter === status ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                                >
                                    {status}
                                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusFilter === status ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                                        {count}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                    <button className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors w-full sm:w-auto">
                        <span className="material-icons text-[18px]">filter_list</span>
                        Filter
                    </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/50 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <th className="px-6 py-4 border-b border-slate-100">Report ID</th>
                                <th className="px-4 py-4 border-b border-slate-100">Patient</th>
                                <th className="px-4 py-4 border-b border-slate-100">Test Name</th>
                                <th className="px-4 py-4 border-b border-slate-100">Authorized</th>
                                <th className="px-4 py-4 border-b border-slate-100">Methods</th>
                                <th className="px-4 py-4 border-b border-slate-100">Status</th>
                                <th className="px-6 py-4 border-b border-slate-100 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-slate-400 text-sm">
                                        Loading dispatch reports...
                                    </td>
                                </tr>
                            ) : paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-slate-400 text-sm">
                                        No reports found.
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((report) => (
                                    <tr key={report.id} className="border-b border-slate-50 last:border-0 bg-white hover:bg-slate-50/50 transition-colors">

                                        {/* Report ID */}
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-[13px] font-bold text-slate-700">
                                                {formatDisplayId(report.reportId, "REP")}
                                            </span>
                                        </td>

                                        {/* Patient */}
                                        <td className="px-4 py-4">
                                            <div className="text-sm font-bold text-slate-800">{report.patientName}</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">{report.patientId}</div>
                                        </td>

                                        {/* Test Name */}
                                        <td className="px-4 py-4 text-[13px] text-slate-600 font-medium">
                                            {report.testName}
                                        </td>

                                        {/* Authorized */}
                                        <td className="px-4 py-4">
                                            <div className="text-sm text-slate-700 font-medium">{report.authorizedDate}</div>
                                            <div className="text-[11px] text-slate-400 mt-0.5">{report.authorizedTime}</div>
                                        </td>

                                        {/* Delivery Methods */}
                                        <td className="px-4 py-4">
                                            <div className="flex gap-1.5">
                                                {report.deliveryMethods.map((method) => {
                                                    const m = methodIcons[method];
                                                    if (!m) return null;
                                                    return (
                                                        <div
                                                            key={method}
                                                            title={m.label}
                                                            className={`w-7 h-7 rounded-md ${m.bg} flex items-center justify-center border border-white/50 cursor-pointer hover:shadow-sm transition-all`}
                                                        >
                                                            <span className={`material-icons text-[14px] ${m.color}`}>{m.icon}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-4">
                                            {getStatusBadge(report.status)}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => router.push(`/dispatch/authorized-reports/${encodeURIComponent(report.reportId)}`)}
                                                className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
                                            >
                                                View Report
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                    <span className="text-sm text-slate-500">
                        Showing <strong>{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filtered.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</strong> of <strong>{filtered.length}</strong> reports
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage((p) => p - 1)}
                            disabled={currentPage === 1}
                            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <span className="material-icons text-[18px]">chevron_left</span>
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-bold transition-colors ${page === currentPage ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
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
