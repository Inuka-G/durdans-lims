"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuditLogs, AuditLog, AuditLogPage } from "@/lib/api";

// --- Action badge colors ---
const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
    REGISTER_PATIENT: { bg: "bg-emerald-50", text: "text-emerald-700" },
    UPDATE_PROFILE: { bg: "bg-blue-50", text: "text-blue-700" },
    UPDATE_PROFILE_PHOTO: { bg: "bg-sky-50", text: "text-sky-700" },
    UPLOAD_DOCUMENT: { bg: "bg-teal-50", text: "text-teal-700" },
    DELETE_DOCUMENT: { bg: "bg-red-50", text: "text-red-700" },
    VERIFY_EMAIL: { bg: "bg-violet-50", text: "text-violet-700" },
    VERIFY_PHONE: { bg: "bg-indigo-50", text: "text-indigo-700" },
    SEND_OTP: { bg: "bg-amber-50", text: "text-amber-700" },
    SEND_EMAIL_VERIFICATION: { bg: "bg-purple-50", text: "text-purple-700" },
    CREATE: { bg: "bg-green-50", text: "text-green-700" },
    UPDATE: { bg: "bg-blue-50", text: "text-blue-700" },
    DELETE: { bg: "bg-red-50", text: "text-red-700" },
};

function getActionColor(action: string) {
    return ACTION_COLORS[action?.toUpperCase()] || { bg: "bg-slate-50", text: "text-slate-600" };
}

// --- Entity type icons ---
function getEntityIcon(entityType: string) {
    const type = entityType?.toUpperCase();
    if (type === "PATIENT") return "person";
    if (type === "PATIENT_DOCUMENT") return "description";
    if (type === "VERIFICATION") return "verified";
    if (type === "PROFILE_PHOTO") return "photo_camera";
    return "article";
}

export default function AuditLogsPage() {
    const [data, setData] = useState<AuditLogPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("");
    const [entityTypeFilter, setEntityTypeFilter] = useState("");
    const pageSize = 15;

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, unknown> = {
                page,
                size: pageSize,
            };
            if (search.trim()) params.search = search.trim();
            if (actionFilter) params.action = actionFilter;
            if (entityTypeFilter) params.entityType = entityTypeFilter;

            const result = await getAuditLogs(params);
            setData(result);
        } catch (err) {
            console.error("Failed to load audit logs:", err);
        } finally {
            setLoading(false);
        }
    }, [page, search, actionFilter, entityTypeFilter]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Debounce search
    const [searchInput, setSearchInput] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
            setPage(0);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const formatTimestamp = (ts: string) => {
        try {
            const d = new Date(ts);
            return d.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return ts;
        }
    };

    const actionOptions = [
        "REGISTER_PATIENT", "UPDATE_PROFILE", "UPDATE_PROFILE_PHOTO",
        "UPLOAD_DOCUMENT", "DELETE_DOCUMENT",
        "VERIFY_EMAIL", "VERIFY_PHONE", "SEND_OTP", "SEND_EMAIL_VERIFICATION",
    ];

    const entityOptions = ["PATIENT", "PATIENT_DOCUMENT"];

    return (
        <div className="max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-outfit">
                        Audit Logs
                    </h1>
                    <p className="text-base text-slate-500 mt-0.5">
                        Track all system activities and changes across the platform.
                    </p>
                </div>

                {/* Stats Badge */}
                {data && (
                    <div className="flex items-center gap-2">
                        <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                            <span className="material-icons text-lg">analytics</span>
                            {data.totalElements.toLocaleString()} Total Entries
                        </div>
                    </div>
                )}
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Search by patient code, user, action..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>

                    {/* Action Filter */}
                    <select
                        value={actionFilter}
                        onChange={(e) => {
                            setActionFilter(e.target.value);
                            setPage(0);
                        }}
                        className="px-4 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700 min-w-[150px]"
                    >
                        <option value="">All Actions</option>
                        {actionOptions.map((a) => (
                            <option key={a} value={a}>
                                {a.replaceAll("_", " ")}
                            </option>
                        ))}
                    </select>

                    {/* Entity Type Filter */}
                    <select
                        value={entityTypeFilter}
                        onChange={(e) => {
                            setEntityTypeFilter(e.target.value);
                            setPage(0);
                        }}
                        className="px-4 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700 min-w-[160px]"
                    >
                        <option value="">All Entities</option>
                        {entityOptions.map((e) => (
                            <option key={e} value={e}>
                                {e.replaceAll("_", " ")}
                            </option>
                        ))}
                    </select>

                    {/* Clear Filters */}
                    {(searchInput || actionFilter || entityTypeFilter) && (
                        <button
                            onClick={() => {
                                setSearchInput("");
                                setSearch("");
                                setActionFilter("");
                                setEntityTypeFilter("");
                                setPage(0);
                            }}
                            className="flex items-center gap-1 px-3 py-2.5 text-sm font-semibold text-slate-500 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all"
                        >
                            <span className="material-icons text-sm">close</span>
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                                    Timestamp
                                </th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                                    Action
                                </th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                                    Entity
                                </th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 hidden md:table-cell">
                                    Patient Code
                                </th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 hidden lg:table-cell">
                                    Performed By
                                </th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 hidden lg:table-cell">
                                    Branch
                                </th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 hidden xl:table-cell">
                                    IP Address
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <span className="material-icons animate-spin text-primary text-3xl">
                                                sync
                                            </span>
                                            <span className="text-sm font-medium">
                                                Loading audit logs...
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : !data || data.content.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <span className="material-icons text-4xl text-slate-200">
                                                event_note
                                            </span>
                                            <span className="text-sm font-medium">
                                                No audit logs found.
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                Try adjusting your filters or search query.
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data.content.map((log: AuditLog) => {
                                    const actionColor = getActionColor(log.action);
                                    return (
                                        <tr
                                            key={log.id}
                                            className="hover:bg-slate-50/70 transition-colors"
                                        >
                                            {/* Timestamp */}
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                                                    {formatTimestamp(log.timestamp)}
                                                </span>
                                            </td>
                                            {/* Action */}
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase rounded-full tracking-wider ${actionColor.bg} ${actionColor.text}`}
                                                >
                                                    {log.action.replaceAll("_", " ")}
                                                </span>
                                            </td>
                                            {/* Entity */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-icons text-slate-400 text-lg">
                                                        {getEntityIcon(log.entityType)}
                                                    </span>
                                                    <span className="text-sm font-semibold text-slate-600">
                                                        {log.entityType?.replaceAll("_", " ") || "—"}
                                                    </span>
                                                </div>
                                            </td>
                                            {/* Patient Code */}
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                {log.patientCode ? (
                                                    <span className="text-sm font-mono font-semibold text-primary">
                                                        {log.patientCode}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-slate-300">—</span>
                                                )}
                                            </td>
                                            {/* Performed By */}
                                            <td className="px-4 py-3 hidden lg:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 uppercase flex-shrink-0">
                                                        {log.performedBy?.[0] || "?"}
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-700">
                                                        {log.performedBy || "—"}
                                                    </span>
                                                </div>
                                            </td>
                                            {/* Branch */}
                                            <td className="px-4 py-3 hidden lg:table-cell">
                                                <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                    {log.branchCode || "—"}
                                                </span>
                                            </td>
                                            {/* IP */}
                                            <td className="px-4 py-3 hidden xl:table-cell">
                                                <span className="text-xs font-mono text-slate-400">
                                                    {log.ipAddress || "—"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {data && data.totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm font-medium text-slate-500">
                        <span>
                            Page {data.page + 1} of {data.totalPages} •{" "}
                            <span className="text-slate-400">
                                {data.totalElements.toLocaleString()} total
                            </span>
                        </span>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={data.page === 0}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage((p) => p + 1)}
                                disabled={data.last}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
