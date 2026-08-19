"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    HISTORY_DATE_RANGES,
    resolveFromTimestamp,
    type HistoryDateRange,
} from "@/lib/history-date-range";
import { downloadCsv } from "@/lib/export-csv";
import { formatDisplayId } from "@/lib/format-id";
import { PRIORITY_COLORS, formatStatusLabel } from "@/constants/sample-lifecycle";
import {
    getClinicalHistory,
    VerificationHistoryItem,
} from "@/lib/api";

const PAGE_SIZE = 10;

const ACTION_LABELS: Record<string, string> = {
    CLINICAL_AUTHORIZED: "Authorized by Pathologist",
    VERIFICATION_RETURNED_FROM_CLINICAL: "Returned to Supervisor",
};

const ACTION_BADGES: Record<string, string> = {
    CLINICAL_AUTHORIZED:
        "border border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm shadow-emerald-100/70",
    VERIFICATION_RETURNED_FROM_CLINICAL:
        "border border-amber-200 bg-amber-50 text-amber-800 shadow-sm shadow-amber-100/70",
};

const resolveActionType = (item: VerificationHistoryItem) => {
    if (item.actionType) {
        return item.actionType;
    }

    if (item.actionSummary === "Authorized by Pathologist") {
        return "CLINICAL_AUTHORIZED";
    }

    if (item.actionSummary === "Returned to Supervisor") {
        return "VERIFICATION_RETURNED_FROM_CLINICAL";
    }

    return "";
};

const formatTimestamp = (value?: string | null) => {
    if (!value) {
        return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString("en-LK", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export default function ClinicalHistoryPage() {
    const router = useRouter();
    const [allHistoryItems, setAllHistoryItems] = useState<VerificationHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [dateRange, setDateRange] = useState<HistoryDateRange>("ALL");
    const [search, setSearch] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);

    useEffect(() => {
        setPage(0);
    }, [search, statusFilter, dateRange]);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                setLoading(true);
                setError(null);

                const historyPage = await getClinicalHistory(0, 1000, {
                    fromTimestamp: resolveFromTimestamp(dateRange),
                });

                setAllHistoryItems(historyPage.content ?? []);
            } catch (loadError) {
                console.error("Failed to load clinical history", loadError);
                setError("Failed to load clinical history. Please try again.");
                setAllHistoryItems([]);
            } finally {
                setLoading(false);
            }
        };

        void loadHistory();
    }, [dateRange]);

    const filteredHistoryItems = useMemo(() => {
        return allHistoryItems.filter((item) => {
            const actionType = resolveActionType(item);
            const matchesStatus = statusFilter === "ALL" || actionType === statusFilter;
            if (!matchesStatus) {
                return false;
            }

            if (!search.trim()) {
                return true;
            }

            const q = search.trim().toLowerCase();
            const displayResultId = formatDisplayId(item.resultId, "RES").toLowerCase();
            const patientName = (item.patientName || "").toLowerCase();
            const patientCode = (item.patientCode || "").toLowerCase();
            const testName = (item.testName || "").toLowerCase();
            const performedBy = (item.performedBy || "").toLowerCase();
            const notes = (item.notes || "").toLowerCase();
            const actionSummary = (item.actionSummary || ACTION_LABELS[actionType] || "").toLowerCase();

            return (
                displayResultId.includes(q) ||
                patientName.includes(q) ||
                patientCode.includes(q) ||
                testName.includes(q) ||
                performedBy.includes(q) ||
                notes.includes(q) ||
                actionSummary.includes(q)
            );
        });
    }, [allHistoryItems, statusFilter, search]);

    const totalElements = filteredHistoryItems.length;
    const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
    const paginatedItems = useMemo(() => {
        return filteredHistoryItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    }, [filteredHistoryItems, page]);

    const hasActiveFilters =
        search.trim().length > 0 || statusFilter !== "ALL" || dateRange !== "ALL";

    const handleExportCsv = async () => {
        setIsExporting(true);
        setExportError(null);

        try {
            if (filteredHistoryItems.length === 0) {
                return;
            }

            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

            downloadCsv(
                `clinical-history-${stamp}`,
                [
                    "Timestamp",
                    "Patient",
                    "Patient Code",
                    "Result ID",
                    "Test Group",
                    "Action",
                    "Priority",
                    "Performed By",
                    "Notes",
                ],
                filteredHistoryItems.map((item) => {
                    const actionType = resolveActionType(item);

                    return [
                        formatTimestamp(item.actionAt ?? item.updatedAt),
                        item.patientName || "Unknown patient",
                        item.patientCode || "",
                        formatDisplayId(item.resultId, "RES"),
                        item.testName || "Unknown Test Group",
                        item.actionSummary || ACTION_LABELS[actionType] || "Workflow Updated",
                        item.specimenPriority ? formatStatusLabel(item.specimenPriority) : "",
                        item.performedBy || "",
                        item.notes || "",
                    ];
                })
            );
        } catch (exportFailure) {
            console.error("Failed to export clinical history", exportFailure);
            setExportError(
                "Could not export the clinical history. Check your connection, then try the export again."
            );
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                        Clinical Approval
                    </p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                        Clinical History
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Track pathologist authorizations and cases returned to the lab supervisor for recheck.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Period">
                        {HISTORY_DATE_RANGES.map((range) => {
                            const isActive = dateRange === range.key;
                            return (
                                <button
                                    key={range.key}
                                    type="button"
                                    onClick={() => setDateRange(range.key)}
                                    aria-pressed={isActive}
                                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                                        isActive
                                            ? "bg-primary text-white"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    {range.label}
                                </button>
                            );
                        })}
                    </div>

                    {!loading && !error && (
                        <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                            <span className="material-icons text-lg">history</span>
                            {totalElements.toLocaleString()} History Entries
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => void handleExportCsv()}
                        disabled={isExporting || totalElements === 0}
                        title="Exports every history entry matching the current search and filters"
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <span
                            className={`material-icons text-lg ${isExporting ? "animate-spin" : ""}`}
                        >
                            {isExporting ? "sync" : "download"}
                        </span>
                        {isExporting ? "Exporting..." : "Export CSV"}
                    </button>
                </div>
            </div>

            {exportError && (
                <div
                    role="alert"
                    className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                >
                    <span className="material-icons text-lg">error_outline</span>
                    {exportError}
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Search by patient name, patient code, result ID, test group, or pathologist..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="px-4 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-700 min-w-[220px]"
                    >
                        <option value="ALL">All Actions</option>
                        <option value="CLINICAL_AUTHORIZED">Authorized by Pathologist</option>
                        <option value="VERIFICATION_RETURNED_FROM_CLINICAL">Returned to Supervisor</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Result ID</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Patient</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Test Group</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Action</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Priority</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Performed By</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Notes</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 text-right">Case</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <span className="material-icons animate-spin text-primary text-3xl">
                                                sync
                                            </span>
                                            <span className="text-sm font-medium">
                                                Loading clinical history...
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <span className="material-icons text-4xl text-red-200">
                                                error
                                            </span>
                                            <span className="text-sm font-medium">{error}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredHistoryItems.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <span className="material-icons text-4xl text-slate-200">
                                                history
                                            </span>
                                            <span className="text-sm font-medium">
                                                {hasActiveFilters
                                                    ? "No clinical history matches the current search or filter."
                                                    : "No clinical history found."}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedItems.map((item) => {
                                    const actionType = resolveActionType(item);

                                    return (
                                        <tr
                                            key={`${item.resultId}-${item.actionAt ?? item.updatedAt ?? actionType ?? "event"}`}
                                            className="hover:bg-slate-50/70 transition-colors"
                                        >
                                            <td className="px-4 py-3">
                                                <span
                                                    className="text-sm font-mono font-semibold text-slate-800"
                                                    title={item.resultId}
                                                >
                                                    {formatDisplayId(item.resultId, "RES")}
                                                </span>
                                                <p className="mt-1 text-xs text-slate-500 whitespace-nowrap">
                                                    {formatTimestamp(item.actionAt ?? item.updatedAt)}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {item.patientName || "Unknown patient"}
                                                </p>
                                                {item.patientCode && (
                                                    <p className="mt-0.5 font-mono text-xs text-slate-500">
                                                        {item.patientCode}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-semibold text-slate-800">
                                                    {item.testName || "Unknown Test Group"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ACTION_BADGES[actionType] || "border border-slate-200 bg-slate-50 text-slate-700"}`}
                                                >
                                                    {item.actionSummary || ACTION_LABELS[actionType] || "Workflow Updated"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.specimenPriority ? (
                                                    <span
                                                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                            PRIORITY_COLORS[
                                                                item.specimenPriority.toUpperCase() as keyof typeof PRIORITY_COLORS
                                                            ] ?? "bg-slate-100 text-slate-600"
                                                        }`}
                                                    >
                                                        {formatStatusLabel(item.specimenPriority)}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-semibold text-slate-700">
                                                    {item.performedBy || "-"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-slate-500">
                                                    {item.notes || "-"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!item.resultId) {
                                                            return;
                                                        }
                                                        router.push(`/clinical/review/${item.resultId}`);
                                                    }}
                                                    disabled={!item.resultId}
                                                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-primary/30 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
                                                >
                                                    Review case
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && !error && totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm font-medium text-slate-500">
                        <span>
                            Page {page + 1} of {totalPages} •{" "}
                            <span className="text-slate-400">
                                {totalElements.toLocaleString()} matching
                            </span>
                        </span>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setPage((previous) => Math.max(0, previous - 1))}
                                disabled={page === 0}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage((previous) => Math.min(totalPages - 1, previous + 1))}
                                disabled={page >= totalPages - 1}
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
