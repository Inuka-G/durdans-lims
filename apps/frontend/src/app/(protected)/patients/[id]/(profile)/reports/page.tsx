"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, FileText, RefreshCw } from "lucide-react";
import { getPatientReports, type DispatchDashboardItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { formatRegistered } from "@/components/patient-dashboard/dashboard-data";
import { usePatient } from "../../PatientProvider";

/* ------------------------------------------------------------------ */
/*  Status chip — colour = meaning, same tokens as the rest of the module */
/* ------------------------------------------------------------------ */

type StatusToken = { label: string; chip: string; dot: string };

const STATUS_TOKEN: Record<string, StatusToken> = {
    PENDING: {
        label: "Pending",
        chip: "bg-status-pending-bg text-status-pending-fg ring-status-pending-edge",
        dot: "bg-status-pending",
    },
    PARTIAL: {
        label: "Partially delivered",
        chip: "bg-primary-soft text-primary-strong ring-edge",
        dot: "bg-primary",
    },
    DELIVERED: {
        label: "Delivered",
        chip: "bg-status-verified-bg text-status-verified-fg ring-status-verified-edge",
        dot: "bg-status-verified",
    },
    FAILED: {
        label: "Failed",
        chip: "bg-status-danger-bg text-status-danger-fg ring-status-danger-edge",
        dot: "bg-status-danger",
    },
};

const NEUTRAL_TOKEN: Omit<StatusToken, "label"> = {
    chip: "bg-surface-muted text-fg-secondary ring-edge",
    dot: "bg-fg-faint",
};

/** Sentence-case fallback for statuses we don't have a token for. */
function formatStatus(value?: string | null) {
    if (!value) return "—";
    const words = value.replace(/_/g, " ").toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function ReportStatusChip({ status }: { status?: string | null }) {
    const key = status ? status.toUpperCase() : "";
    const token = STATUS_TOKEN[key];
    const label = token?.label ?? formatStatus(status);
    const chip = token?.chip ?? NEUTRAL_TOKEN.chip;
    const dot = token?.dot ?? NEUTRAL_TOKEN.dot;
    return (
        <span
            title={label}
            className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-inset",
                chip
            )}
        >
            <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
            {label}
        </span>
    );
}

/* ------------------------------------------------------------------ */
/*  Dates                                                               */
/* ------------------------------------------------------------------ */

function parseAuthorizedAt(report: DispatchDashboardItem): Date | null {
    const dateValue = report.authorizedDate;
    const timeValue = report.authorizedTime;
    if (!dateValue && !timeValue) return null;

    const parsed = dateValue && timeValue ? new Date(`${dateValue}T${timeValue}`) : new Date(dateValue || timeValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * "Today 09:12" / "Yesterday 14:02" / "16 Aug 2026 09:12"; falls back to the raw API strings.
 * Older reports keep their time (same-day repeats matter on lab reports) — but only when
 * the API actually supplied one, so a date-only record doesn't grow a fake midnight.
 */
function formatAuthorizedAt(report: DispatchDashboardItem) {
    const parsed = parseAuthorizedAt(report);
    if (parsed) {
        const label = formatRegistered(parsed);
        if (/^(Today|Yesterday)/.test(label) || !report.authorizedTime) return label;
        const time = parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
        return `${label} ${time}`;
    }
    const raw = [report.authorizedDate, report.authorizedTime].filter(Boolean).join(", ");
    return raw || "—";
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

const SKELETON_ROWS = 5;

export default function PatientReportsTab() {
    const { patient } = usePatient();
    const [reports, setReports] = useState<DispatchDashboardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const patientCode = patient?.patientCode || patient?.id || "";

    const loadReports = useCallback(async () => {
        if (!patientCode) {
            setReports([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError("");
            const response = await getPatientReports(patientCode, 0, 50);
            setReports(response.content || []);
        } catch (loadError) {
            console.error("Failed to load patient reports", loadError);
            setError("Could not load this patient's laboratory reports.");
            setReports([]);
        } finally {
            setLoading(false);
        }
    }, [patientCode]);

    useEffect(() => {
        void loadReports();
    }, [loadReports]);

    if (!patient) return null;

    const showCount = !loading && !error;

    return (
        <SectionCard
            title="Laboratory reports"
            count={showCount ? reports.length : undefined}
            flush
            className="mb-8"
            actions={
                <Button
                    size="sm"
                    variant="ghost"
                    icon={RefreshCw}
                    onClick={() => void loadReports()}
                    disabled={loading}
                >
                    Refresh
                </Button>
            }
        >
            {/* States live outside the 760px-wide table so they centre on small screens */}
            {loading ? (
                <div role="status" aria-live="polite">
                    <span className="sr-only">Loading reports…</span>
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-24 shrink-0 rounded bg-skeleton" />
                                <span className="h-3 w-44 rounded bg-skeleton" />
                                <span className="ml-auto hidden h-3 w-20 rounded bg-skeleton sm:block" />
                                <span className="hidden h-4 w-16 rounded bg-skeleton md:block" />
                                <span className="h-6 w-14 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : error ? (
                <div role="alert">
                    <EmptyState
                        icon={AlertTriangle}
                        title="Reports unavailable"
                        description={error}
                        compact
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => void loadReports()}>
                                Retry
                            </Button>
                        }
                    />
                </div>
            ) : reports.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title="No reports yet"
                    description="Authorised laboratory reports for this patient will appear here."
                    compact
                    action={
                        <Button size="sm" icon={RefreshCw} onClick={() => void loadReports()}>
                            Refresh
                        </Button>
                    }
                />
            ) : (
                <div className="overflow-x-auto">
                    {/*
                     * table-fixed budget — the percentages resolve against the table's own width,
                     * so they have to leave room for the fixed actions column: 0.86·760 = 653.6
                     * + 96 (w-24) = 749.6 <= 760. Checked against worst-case content at min width:
                     * id 108.8px, test 173.6px, "16 Aug 2026 09:12" 128px, "Partially delivered"
                     * chip 143px, View button 76px.
                     */}
                    <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                        <thead>
                            <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                <th scope="col" className="w-[18%] py-2 pl-4 pr-3 font-semibold">
                                    Report id
                                </th>
                                <th scope="col" className="w-[26%] px-3 py-2 font-semibold">
                                    Test
                                </th>
                                <th scope="col" className="w-[20%] px-3 py-2 font-semibold">
                                    Authorised
                                </th>
                                <th scope="col" className="w-[22%] px-3 py-2 font-semibold">
                                    Status
                                </th>
                                <th scope="col" className="w-24 py-2 pl-2 pr-3 text-right">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-edge whitespace-nowrap">
                            {reports.map((report) => {
                                const authorizedAt = parseAuthorizedAt(report);
                                return (
                                    <tr key={report.id || report.reportId} className="transition-colors hover:bg-surface-hover">
                                        <td
                                            className="truncate py-2 pl-4 pr-3 font-mono text-xs text-fg-secondary"
                                            title={report.reportId || undefined}
                                        >
                                            {report.reportId || "—"}
                                        </td>
                                        <td className="truncate px-3 py-2 font-medium text-fg" title={report.testName || undefined}>
                                            {report.testName || "—"}
                                        </td>
                                        <td className="px-3 py-2 tabular-nums text-fg-secondary">
                                            <time
                                                dateTime={authorizedAt ? authorizedAt.toISOString() : undefined}
                                                title={authorizedAt ? authorizedAt.toLocaleString() : undefined}
                                            >
                                                {formatAuthorizedAt(report)}
                                            </time>
                                        </td>
                                        <td className="px-3 py-2">
                                            <ReportStatusChip status={report.status} />
                                        </td>
                                        <td className="py-2 pl-2 pr-3 text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                icon={ExternalLink}
                                                href={`/dispatch/authorized-reports/${encodeURIComponent(report.reportId)}`}
                                                aria-label={`View report ${report.reportId}`}
                                            >
                                                View
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Footer */}
            {showCount && reports.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge px-4 py-2 text-xs text-fg-muted">
                    <span className="tabular-nums">
                        Showing {reports.length} report{reports.length === 1 ? "" : "s"}
                    </span>
                </div>
            )}
        </SectionCard>
    );
}
