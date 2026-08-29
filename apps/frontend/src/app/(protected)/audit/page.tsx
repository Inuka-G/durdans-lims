"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    AlertTriangle,
    Camera,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    File,
    FileText,
    History,
    RefreshCw,
    Search,
    ShieldCheck,
    User,
    X,
    type LucideIcon,
} from "lucide-react";
import { getAuditLogs, type AuditLog, type AuditLogPage } from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { InputField, SelectField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { formatAuditTime } from "@/components/patient-dashboard/dashboard-data";

const PAGE_SIZE = 15;
const SKELETON_ROWS = 8;

const ACTION_OPTIONS = [
    "REGISTER_PATIENT",
    "UPDATE_PROFILE",
    "UPDATE_PROFILE_PHOTO",
    "UPLOAD_DOCUMENT",
    "DELETE_DOCUMENT",
    "VERIFY_EMAIL",
    "VERIFY_PHONE",
    "SEND_OTP",
    "SEND_EMAIL_VERIFICATION",
];

const ENTITY_OPTIONS = ["PATIENT", "PATIENT_DOCUMENT"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Words that stay upper-case when humanising enum-style labels. */
const ACRONYMS = new Set(["otp", "ip", "id", "nic"]);

/** "REGISTER_PATIENT" → "Register patient", "SEND_OTP" → "Send OTP" */
function formatLabel(value?: string | null): string {
    if (!value) return "—";
    const words = value.toLowerCase().split("_").filter(Boolean);
    if (words.length === 0) return "—";
    return words
        .map((w, i) => (ACRONYMS.has(w) ? w.toUpperCase() : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(" ");
}

function getEntityIcon(entityType?: string): LucideIcon {
    const type = entityType?.toUpperCase();
    if (type === "PATIENT") return User;
    if (type === "PATIENT_DOCUMENT") return FileText;
    if (type === "VERIFICATION") return ShieldCheck;
    if (type === "PROFILE_PHOTO") return Camera;
    return File;
}

/** Full, unambiguous timestamp for tooltips and the expanded panel. */
function formatFullTimestamp(ts: string): string {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts || "—";
    return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}

function parseDetails(details?: string): Record<string, unknown> | null {
    if (!details) return null;
    try {
        const parsed = JSON.parse(details);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function detailValue(value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/** One-line summary for the table cell: "patientName: Jane · field: phone". */
function summariseDetails(details?: string): string {
    if (!details) return "";
    const parsed = parseDetails(details);
    if (!parsed) return details;
    return Object.entries(parsed)
        .map(([k, v]) => `${k}: ${detailValue(v)}`)
        .join(" · ");
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AuditLogsPage() {
    const [data, setData] = useState<AuditLogPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("");
    const [entityTypeFilter, setEntityTypeFilter] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // Debounced search input → committed search term
    const [searchInput, setSearchInput] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
            setPage(0);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Fetch whenever paging / filters change. Stale responses are ignored so a
    // slow earlier request can't overwrite a newer one.
    useEffect(() => {
        let active = true;
        setLoading(true);
        setLoadError(null);

        const params: Record<string, unknown> = { page, size: PAGE_SIZE };
        if (search.trim()) params.search = search.trim();
        if (actionFilter) params.action = actionFilter;
        if (entityTypeFilter) params.entityType = entityTypeFilter;

        getAuditLogs(params)
            .then((result) => {
                if (!active) return;
                setData(result);
                setExpanded({});
            })
            .catch((err) => {
                console.error("Failed to load audit logs:", err);
                if (active) setLoadError("Couldn't load the audit log. Check your connection and retry.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [page, search, actionFilter, entityTypeFilter, reloadKey]);

    const retry = useCallback(() => setReloadKey((k) => k + 1), []);

    const hasFilters = Boolean(searchInput || actionFilter || entityTypeFilter);

    const clearFilters = () => {
        setSearchInput("");
        setSearch("");
        setActionFilter("");
        setEntityTypeFilter("");
        setPage(0);
    };

    const toggleRow = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    const rows = data?.content ?? [];
    const total = data?.totalElements ?? null;
    // The footer stays mounted while a new page loads (keyed off the last known
    // page) so the pager keeps focus and the card height doesn't jump.
    const showFooter = data !== null && !loadError && (loading || rows.length > 0);

    const goToPreviousPage = () => {
        if (loading) return;
        setPage((p) => Math.max(0, p - 1));
    };
    const goToNextPage = () => {
        if (loading) return;
        setPage((p) => p + 1);
    };

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Audit log"
                crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Audit log" }]}
                meta={
                    <>
                        <History className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Patient module activity</span>
                        {total !== null && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {total.toLocaleString()} {total === 1 ? "entry" : "entries"}
                                </span>
                            </>
                        )}
                    </>
                }
                actions={
                    <Button icon={RefreshCw} onClick={retry} loading={loading && data !== null}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? "Loading audit log"
                    : loadError
                      ? "Audit log failed to load"
                      : `Audit log loaded. Showing ${rows.length} of ${total ?? rows.length} entries${
                            data && data.totalPages > 1 ? `, page ${data.page + 1} of ${data.totalPages}` : ""
                        }.`}
            </p>

            <SectionCard title="Entries" count={total !== null ? total.toLocaleString() : undefined} flush>
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <InputField
                        label="Search audit log"
                        hideLabel
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search patient code, user or action"
                        autoComplete="off"
                        className="min-w-[200px] flex-1"
                    />
                    <SelectField
                        label="Action"
                        hideLabel
                        value={actionFilter}
                        onChange={(e) => {
                            setActionFilter(e.target.value);
                            setPage(0);
                        }}
                        className="w-full sm:w-48"
                    >
                        <option value="">All actions</option>
                        {ACTION_OPTIONS.map((a) => (
                            <option key={a} value={a}>
                                {formatLabel(a)}
                            </option>
                        ))}
                    </SelectField>
                    <SelectField
                        label="Entity type"
                        hideLabel
                        value={entityTypeFilter}
                        onChange={(e) => {
                            setEntityTypeFilter(e.target.value);
                            setPage(0);
                        }}
                        className="w-full sm:w-44"
                    >
                        <option value="">All entity types</option>
                        {ENTITY_OPTIONS.map((e) => (
                            <option key={e} value={e}>
                                {formatLabel(e)}
                            </option>
                        ))}
                    </SelectField>
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
                                <span className="h-3 w-20 shrink-0 rounded bg-skeleton" />
                                <span className="h-4 w-28 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton md:block" />
                                <span className="h-3 w-24 rounded bg-skeleton" />
                                <span className="hidden h-3 w-28 rounded bg-skeleton lg:block" />
                                <span className="hidden h-3 w-12 rounded bg-skeleton lg:block" />
                                <span className="ml-auto h-3 w-1/4 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : loadError ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Audit log unavailable"
                        description={loadError}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={retry}>
                                Retry
                            </Button>
                        }
                    />
                ) : rows.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={Search}
                            title="No entries match"
                            description="Try a different search term, action or entity type."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={History}
                            title="No audit entries yet"
                            description="Registrations, edits, uploads and verifications will be recorded here."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        {/* table-fixed column budget — the sum of the fixed widths at each band
                            plus a >=160px floor for the auto-width Details column must stay
                            within min-w, or Details collapses to 0px:
                              base 488 + 160 =  648  <=  760
                              md   632 + 160 =  792  <=  800
                              lg   872 + 160 = 1032  <= 1040
                              xl  1000 + 160 = 1160  <= 1170  */}
                        <table className="w-full min-w-[760px] table-fixed text-left text-sm md:min-w-[800px] lg:min-w-[1040px] xl:min-w-[1170px]">
                            <caption className="sr-only">Audit log entries</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-36 py-2 pl-4 pr-3 font-semibold">
                                        Time
                                    </th>
                                    <th scope="col" className="w-44 px-3 py-2 font-semibold">
                                        Action
                                    </th>
                                    <th scope="col" className="hidden w-36 px-3 py-2 font-semibold md:table-cell">
                                        Entity
                                    </th>
                                    <th scope="col" className="w-32 px-3 py-2 font-semibold">
                                        Subject
                                    </th>
                                    <th scope="col" className="hidden w-36 px-3 py-2 font-semibold lg:table-cell">
                                        Performed by
                                    </th>
                                    <th scope="col" className="hidden w-24 px-3 py-2 font-semibold lg:table-cell">
                                        Branch
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-semibold">
                                        Details
                                    </th>
                                    <th scope="col" className="hidden w-32 px-3 py-2 font-semibold xl:table-cell">
                                        IP address
                                    </th>
                                    <th scope="col" className="w-10 py-2 pl-2 pr-3">
                                        <span className="sr-only">Expand</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {rows.map((log: AuditLog, index) => {
                                    const rowId = log.id || `${log.action}-${log.timestamp}-${index}`;
                                    const open = Boolean(expanded[rowId]);
                                    const panelId = `audit-details-${index}`;
                                    const EntityIcon = getEntityIcon(log.entityType);
                                    const summary = summariseDetails(log.details);
                                    const parsed = parseDetails(log.details);
                                    const fullTime = formatFullTimestamp(log.timestamp);
                                    return (
                                        <Fragment key={rowId}>
                                            <tr className={cn("transition-colors hover:bg-surface-hover", open && "bg-surface-muted")}>
                                                {/* Time */}
                                                <td className="py-2 pl-4 pr-3 tabular-nums text-fg-secondary">
                                                    <time dateTime={log.timestamp} title={fullTime}>
                                                        {formatAuditTime(log.timestamp)}
                                                    </time>
                                                </td>
                                                {/* Action */}
                                                <td className="px-3 py-2">
                                                    <span
                                                        title={formatLabel(log.action)}
                                                        className="inline-block max-w-full truncate rounded bg-surface-muted px-2 py-0.5 align-middle text-[12px] font-medium text-fg-secondary ring-1 ring-inset ring-edge"
                                                    >
                                                        {formatLabel(log.action)}
                                                    </span>
                                                </td>
                                                {/* Entity */}
                                                <td className="hidden px-3 py-2 text-fg-secondary md:table-cell">
                                                    <span className="flex min-w-0 items-center gap-1.5">
                                                        <EntityIcon className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                                                        <span className="truncate" title={formatLabel(log.entityType)}>
                                                            {formatLabel(log.entityType)}
                                                        </span>
                                                    </span>
                                                </td>
                                                {/* Subject */}
                                                <td className="px-3 py-2 font-mono text-xs">
                                                    {log.patientCode ? (
                                                        <Link
                                                            href={`/patients/${log.patientCode}`}
                                                            title={`Open patient ${log.patientCode}`}
                                                            className="inline-block max-w-full truncate rounded align-middle font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                                        >
                                                            {log.patientCode}
                                                        </Link>
                                                    ) : log.entityId ? (
                                                        <span className="inline-block max-w-full truncate align-middle text-fg-muted" title={log.entityId}>
                                                            {log.entityId}
                                                        </span>
                                                    ) : (
                                                        <span className="text-fg-faint">—</span>
                                                    )}
                                                </td>
                                                {/* Performed by */}
                                                <td className="hidden truncate px-3 py-2 text-fg-secondary lg:table-cell" title={log.performedBy || undefined}>
                                                    {log.performedBy || "—"}
                                                </td>
                                                {/* Branch */}
                                                <td className="hidden truncate px-3 py-2 text-fg-secondary lg:table-cell" title={log.branchCode || undefined}>
                                                    {log.branchCode || "—"}
                                                </td>
                                                {/* Details */}
                                                <td className="truncate px-3 py-2 text-fg-muted" title={summary || undefined}>
                                                    {summary || <span className="text-fg-faint">—</span>}
                                                </td>
                                                {/* IP */}
                                                <td
                                                    className="hidden truncate px-3 py-2 font-mono text-xs text-fg-muted xl:table-cell"
                                                    title={log.ipAddress || undefined}
                                                >
                                                    {log.ipAddress || "—"}
                                                </td>
                                                {/* Expand */}
                                                <td className="py-2 pl-2 pr-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleRow(rowId)}
                                                        aria-expanded={open}
                                                        aria-controls={open ? panelId : undefined}
                                                        aria-label={open ? "Hide entry details" : "Show entry details"}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                    >
                                                        <ChevronDown
                                                            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                                                            aria-hidden="true"
                                                        />
                                                    </button>
                                                </td>
                                            </tr>
                                            {open && (
                                                <tr id={panelId} className="bg-surface-muted">
                                                    <td colSpan={9} className="whitespace-normal py-3 pl-4 pr-3">
                                                        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
                                                            <dt className="text-fg-muted">Time</dt>
                                                            <dd className="tabular-nums text-fg">{fullTime}</dd>
                                                            <dt className="text-fg-muted">Performed by</dt>
                                                            <dd className="break-words text-fg">{log.performedBy || "—"}</dd>
                                                            <dt className="text-fg-muted">Branch</dt>
                                                            <dd className="text-fg">{log.branchCode || "—"}</dd>
                                                            <dt className="text-fg-muted">Entity</dt>
                                                            <dd className="text-fg">{formatLabel(log.entityType)}</dd>
                                                            {log.entityId && (
                                                                <>
                                                                    <dt className="text-fg-muted">Entity id</dt>
                                                                    <dd className="break-all font-mono text-fg">{log.entityId}</dd>
                                                                </>
                                                            )}
                                                            <dt className="text-fg-muted">IP address</dt>
                                                            <dd className="font-mono text-fg">{log.ipAddress || "—"}</dd>
                                                            {parsed ? (
                                                                Object.entries(parsed).map(([key, value]) => (
                                                                    <Fragment key={key}>
                                                                        <dt className="break-words text-fg-muted">{key}</dt>
                                                                        <dd className="break-words text-fg">{detailValue(value)}</dd>
                                                                    </Fragment>
                                                                ))
                                                            ) : log.details ? (
                                                                <>
                                                                    <dt className="text-fg-muted">Details</dt>
                                                                    <dd>
                                                                        <pre className="whitespace-pre-wrap break-words font-mono text-xs text-fg">
                                                                            {log.details}
                                                                        </pre>
                                                                    </dd>
                                                                </>
                                                            ) : null}
                                                        </dl>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer: paging */}
                {showFooter && data && (
                    <div
                        aria-busy={loading || undefined}
                        className="flex flex-wrap items-center justify-between gap-2 border-t border-edge px-4 py-2 text-xs text-fg-muted"
                    >
                        <span className="tabular-nums">
                            Page {data.page + 1} of {Math.max(1, data.totalPages)}
                            <span aria-hidden="true"> · </span>
                            {data.totalElements.toLocaleString()} {data.totalElements === 1 ? "entry" : "entries"}
                        </span>
                        {data.totalPages > 1 && (
                            <nav aria-label="Audit log pagination" className="flex items-center gap-1">
                                {/* While loading we use aria-disabled (not disabled) so the
                                    focused button is not blurred mid-page-change. */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={ChevronLeft}
                                    onClick={goToPreviousPage}
                                    disabled={data.page === 0}
                                    aria-disabled={loading || undefined}
                                    className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={goToNextPage}
                                    disabled={data.last}
                                    aria-disabled={loading || undefined}
                                    className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                                >
                                    Next
                                    <ChevronRight aria-hidden="true" />
                                </Button>
                            </nav>
                        )}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
