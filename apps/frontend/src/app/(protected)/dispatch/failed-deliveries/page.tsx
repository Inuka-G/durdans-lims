"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
    listFailedDeliveries,
    retryDispatchAttempt,
    type FailedDeliveryRow,
    type ApiDeliveryMethod,
} from "@/lib/api";

const ITEMS_PER_PAGE = 10;

const methodIcons: Record<ApiDeliveryMethod, { icon: string; color: string; bg: string; label: string }> = {
    EMAIL: { icon: "mail", color: "text-blue-700", bg: "bg-blue-50", label: "Email" },
    SMS: { icon: "smartphone", color: "text-amber-700", bg: "bg-amber-50", label: "SMS" },
    WHATSAPP: { icon: "chat", color: "text-green-700", bg: "bg-green-50", label: "WhatsApp" },
    POST: { icon: "local_shipping", color: "text-indigo-700", bg: "bg-indigo-50", label: "Post" },
    PRINT: { icon: "print", color: "text-emerald-700", bg: "bg-emerald-50", label: "Print" },
    PORTAL: { icon: "language", color: "text-purple-700", bg: "bg-purple-50", label: "Portal" },
};

export default function FailedDeliveriesPage() {
    const [search, setSearch] = useState("");
    const [methodFilter, setMethodFilter] = useState("All");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [retriedIds, setRetriedIds] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [allFailed, setAllFailed] = useState<FailedDeliveryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadFailed = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const rows = await listFailedDeliveries({ limit: 200 });
            setAllFailed(rows);
        } catch (e) {
            console.error(e);
            setError("Could not load failed deliveries.");
            setAllFailed([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadFailed(); }, [loadFailed]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return allFailed.filter((r) => {
            const matchesSearch =
                r.reportId.toLowerCase().includes(q) ||
                r.patientName.toLowerCase().includes(q) ||
                r.testName.toLowerCase().includes(q) ||
                r.failureReason.toLowerCase().includes(q);
            const matchesMethod = methodFilter === "All" || r.method === methodFilter;
            return matchesSearch && matchesMethod;
        });
    }, [allFailed, search, methodFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated = filtered.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const totalFailed = filtered.length;
    const maxRetries = filtered.filter((r) => r.retryCount >= 5).length;
    const avgRetries = (
        filtered.reduce((sum, r) => sum + r.retryCount, 0) / Math.max(1, filtered.length)
    ).toFixed(1);
    const failureReasons = useMemo(() => {
        const counts = filtered.reduce<Record<string, number>>((acc, row) => {
            const key = row.failureReason || "Unknown reason";
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {});
        const max = Math.max(1, ...Object.values(counts));

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([reason, count]) => ({
                reason,
                count,
                width: `${Math.max(8, Math.round((count / max) * 100))}%`,
            }));
    }, [filtered]);

    const allSelected =
        paginated.length > 0 &&
        paginated.every((r) => selectedIds.includes(r.attemptId));

    const toggleAll = () => {
        if (allSelected) {
            setSelectedIds((prev) => prev.filter((id) => !paginated.some((r) => r.attemptId === id)));
        } else {
            setSelectedIds((prev) => [...new Set([...prev, ...paginated.map((r) => r.attemptId)])]);
        }
    };

    const toggleOne = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleRetry = async (attemptId: string) => {
        try {
            await retryDispatchAttempt(attemptId);
            setRetriedIds((prev) => [...prev, attemptId]);
            setSelectedIds((prev) => prev.filter((id) => id !== attemptId));
            await loadFailed();
        } catch (e) {
            console.error(e);
            toast.error("Retry failed. Check console for details.");
        }
    };

    const handleBulkRetry = async () => {
        try {
            for (const id of selectedIds) {
                await retryDispatchAttempt(id);
                setRetriedIds((prev) => [...prev, id]);
            }
            setSelectedIds([]);
            await loadFailed();
        } catch (e) {
            console.error(e);
            toast.error("One or more retries failed.");
        }
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Failed Deliveries</h1>
                    <p className="text-sm text-slate-500 mt-1">Investigate and retry failed report deliveries.</p>
                </div>
                <div className="relative w-full md:w-auto">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                    <input
                        type="text"
                        placeholder="Search Report ID or Patient..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-72"
                    />
                </div>
            </div>

            {error && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{error}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                            <span className="material-icons text-red-600">report_problem</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{totalFailed}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-semibold text-slate-600">Total Failed</p>
                        <span className="text-[11px] text-red-500 font-medium">Deliveries</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <span className="material-icons text-amber-600">cancel</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{maxRetries}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-semibold text-slate-600">Max Retries Reached</p>
                        <span className="text-[11px] text-amber-500 font-medium">≥ 5 attempts</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                            <span className="material-icons text-purple-600">autorenew</span>
                        </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{avgRetries}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-semibold text-slate-600">Avg Retry Count</p>
                        <span className="text-[11px] text-slate-400 font-medium">Per failed delivery</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mb-8">
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-800 mb-1">Failure overview</h3>
                    <p className="text-xs text-slate-500 mb-4">Structured reasons from the core service</p>
                    <div className="min-h-40 rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                        {loading ? (
                            <div className="flex h-32 items-center justify-center text-sm text-slate-400">Loading...</div>
                        ) : failureReasons.length === 0 ? (
                            <div className="flex h-32 items-center justify-center text-sm text-slate-400">No failures in view</div>
                        ) : (
                            <div className="space-y-3">
                                {failureReasons.map((item) => (
                                    <div key={item.reason}>
                                        <div className="mb-1 flex items-center justify-between gap-3">
                                            <span className="truncate text-xs font-semibold text-slate-600">{item.reason}</span>
                                            <span className="text-xs font-bold text-red-600">{item.count}</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-white">
                                            <div className="h-full rounded-full bg-red-500" style={{ width: item.width }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                    <h3 className="text-sm font-bold text-slate-800 mb-4">Failed by Method</h3>
                    <div className="flex flex-col gap-3">
                        {(Object.keys(methodIcons) as ApiDeliveryMethod[]).map((method) => {
                            const m = methodIcons[method];
                            const count = filtered.filter((r) => r.method === method).length;
                            if (count === 0) return null;
                            return (
                                <button
                                    type="button"
                                    key={method}
                                    onClick={() => { setMethodFilter(method); setCurrentPage(1); }}
                                    className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${methodFilter === method ? "ring-2 ring-primary border-primary" : "border-transparent hover:border-slate-200 cursor-pointer"} ${m.bg}`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
                                        <span className={`material-icons text-[16px] ${m.color}`}>{m.icon}</span>
                                    </div>
                                    <span className="flex-1 text-left text-sm font-bold text-slate-700">{m.label}</span>
                                    <span className="text-lg font-black text-red-500">{count}</span>
                                </button>
                            );
                        })}
                    </div>
                    {methodFilter !== "All" && (
                        <button
                            type="button"
                            onClick={() => setMethodFilter("All")}
                            className="w-full mt-4 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                            Clear Filter
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-b border-slate-100 bg-slate-50/30 gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <span className="text-sm font-bold text-slate-800">Failed Deliveries</span>
                        <span className="px-2.5 py-1 bg-red-100 text-red-700 text-[11px] font-bold rounded-md border border-red-200">
                            {filtered.length} Records
                        </span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {selectedIds.length > 0 && (
                            <button
                                type="button"
                                onClick={() => void handleBulkRetry()}
                                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold border-none rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm shadow-red-600/30 flex-1 sm:flex-none whitespace-nowrap"
                            >
                                <span className="material-icons text-[18px]">autorenew</span>
                                Bulk Retry ({selectedIds.length})
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/50 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <th className="w-12 px-6 py-4 border-b border-slate-100">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleAll}
                                        className="w-4 h-4 text-primary bg-white border-slate-300 rounded focus:ring-primary focus:ring-2 cursor-pointer"
                                    />
                                </th>
                                <th className="px-4 py-4 border-b border-slate-100">Report ID</th>
                                <th className="px-4 py-4 border-b border-slate-100">Patient</th>
                                <th className="px-4 py-4 border-b border-slate-100">Test</th>
                                <th className="px-4 py-4 border-b border-slate-100">Method</th>
                                <th className="px-4 py-4 border-b border-slate-100">Failure Reason</th>
                                <th className="px-4 py-4 border-b border-slate-100">Failed At</th>
                                <th className="px-4 py-4 border-b border-slate-100">Retries</th>
                                <th className="px-6 py-4 border-b border-slate-100 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-16 text-slate-400 text-sm">Loading...</td>
                                </tr>
                            ) : paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-16 text-slate-400 text-sm">
                                        No failed deliveries found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((record) => {
                                    const isSelected = selectedIds.includes(record.attemptId);
                                    const isRetried = retriedIds.includes(record.attemptId);
                                    const m = methodIcons[record.method];

                                    return (
                                        <tr
                                            key={record.attemptId}
                                            className={`border-b border-slate-50 last:border-0 transition-colors ${isRetried ? "bg-emerald-50/50" : isSelected ? "bg-red-50/30" : "bg-white hover:bg-slate-50/50"}`}
                                        >
                                            <td className="px-6 py-4">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleOne(record.attemptId)}
                                                    disabled={isRetried}
                                                    className={`w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary focus:ring-2 ${isRetried ? "cursor-not-allowed opacity-50 bg-slate-100" : "cursor-pointer bg-white"}`}
                                                />
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="font-mono text-[13px] font-bold text-slate-700">{record.reportId}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm font-bold text-slate-800">{record.patientName}</div>
                                            </td>
                                            <td className="px-4 py-4 text-[13px] text-slate-600 font-medium">{record.testName}</td>
                                            <td className="px-4 py-4">
                                                {m && (
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-7 h-7 rounded-md ${m.bg} flex items-center justify-center border border-white/50`}>
                                                            <span className={`material-icons text-[14px] ${m.color}`}>{m.icon}</span>
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-600">{m.label}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-[11px] font-bold rounded-md border border-red-100">
                                                    <span className="material-icons text-[12px]">error_outline</span>
                                                    {record.failureReason}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-xs font-semibold text-slate-600">{record.failedDateTime}</td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${record.retryCount >= 5 ? "bg-red-100 text-red-700 border border-red-200" : "bg-slate-100 text-slate-600"}`}>
                                                    {record.retryCount}x
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isRetried ? (
                                                    <span className="flex items-center justify-end gap-1.5 text-xs font-bold text-emerald-600">
                                                        <span className="material-icons text-[14px]">check_circle</span>
                                                        Retried
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleRetry(record.attemptId)}
                                                        className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm shadow-red-600/30 flex items-center justify-center gap-1.5 ml-auto"
                                                    >
                                                        <span className="material-icons text-[14px]">autorenew</span>
                                                        Retry
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                    <span className="text-sm text-slate-500">
                        Showing <strong>{filtered.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</strong> of <strong>{filtered.length}</strong> records
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
