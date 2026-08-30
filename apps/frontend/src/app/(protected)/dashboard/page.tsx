"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Building2,
    ChevronRight,
    ClipboardCheck,
    Search,
    UserPlus,
    Users,
    UserCheck,
    X,
} from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    getAuditLogs,
    getDashboardStatistics,
    getPatients,
    type AuditLog,
    type DashboardStatistics,
    type Patient,
} from "@/lib/api";
import { useMetadata } from "@/providers/MetadataProvider";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import KpiTile from "@/components/ui/KpiTile";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import SegmentedControl from "@/components/ui/SegmentedControl";
import PatientStatusBadge, { getPatientVerification } from "@/components/patient-dashboard/PatientStatusBadge";
import {
    ACTIVITY_DOT,
    RANGE_DESCRIPTIONS,
    RANGE_OPTIONS,
    buildRegistrationData,
    calculateAge,
    formatGender,
    formatPhone,
    formatRegistered,
    parsePatientCreatedAt,
    parseTrend,
    patientInitials,
    toActivityFeedItem,
    type TimeRange,
} from "@/components/patient-dashboard/dashboard-data";

/**
 * Worklist tabs. "Pending" is a server-side query (phoneVerified=false AND
 * emailVerified=false — the same definition the statistics endpoint uses), so
 * its rows and its count always agree. "Recent" is the newest registrations.
 * There is deliberately no "Verified" tab: verified patients are not work.
 */
type Worklist = "pending" | "recent";

const TABLE_ROWS = 8;
const ACTIVITY_ROWS = 6;
/** Rows loaded per worklist. Totals come from page.totalElements / statistics. */
const PAGE_SIZE = 50;

type PatientPage = { content: Patient[]; totalElements: number | null };

function toPage(data: unknown): PatientPage {
    if (Array.isArray(data)) return { content: data as Patient[], totalElements: null };
    const d = (data ?? {}) as { content?: Patient[]; totalElements?: number };
    return {
        content: d.content ?? [],
        totalElements: typeof d.totalElements === "number" ? d.totalElements : null,
    };
}

function prefersReducedMotion() {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function DashboardPage() {
    const { metadata, loading: metadataLoading } = useMetadata();
    const branchCode = metadata?.currentBranchCode;
    const branchName = metadata?.currentBranchName;

    const [recent, setRecent] = useState<PatientPage>({ content: [], totalElements: null });
    const [pending, setPending] = useState<PatientPage>({ content: [], totalElements: null });
    const [stats, setStats] = useState<DashboardStatistics | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLog[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const [timeRange, setTimeRange] = useState<TimeRange>("7d");
    const [worklist, setWorklist] = useState<Worklist>("pending");
    const [tableSearch, setTableSearch] = useState("");
    const worklistRef = useRef<HTMLElement | null>(null);

    /* ---------------------------------------------------------------- */
    /*  Data loading — waits for metadata so the branch scope is right   */
    /* ---------------------------------------------------------------- */
    useEffect(() => {
        if (!branchCode) {
            // Metadata finished but the account has no branch: don't spin forever.
            if (!metadataLoading) {
                setLoading(false);
                setLoadError("No branch is assigned to your account, so there is nothing to show here.");
            }
            return;
        }
        let active = true;

        async function loadAuditActivity() {
            try {
                const auditData = await getAuditLogs({ page: 0, size: ACTIVITY_ROWS });
                if (active) setAuditLogs(auditData.content || []);
            } catch (auditError) {
                console.error("Failed to load dashboard activity", auditError);
                if (active) setAuditLogs([]);
            }
        }

        async function loadData() {
            setLoading(true);
            setLoadError(null);
            try {
                const base = { branchCode, sort: "createdAt,desc", page: 0, size: PAGE_SIZE };
                const [recentData, pendingData, statsData] = await Promise.all([
                    getPatients(base),
                    getPatients({ ...base, phoneVerified: false, emailVerified: false }),
                    getDashboardStatistics(branchCode),
                ]);
                if (!active) return;
                setRecent(toPage(recentData));
                setPending(toPage(pendingData));
                setStats(statsData);
            } catch (error) {
                console.error("Failed to load dashboard data", error);
                if (active) setLoadError("Couldn't load dashboard data. Check your connection and retry.");
            } finally {
                if (active) setLoading(false);
            }
            await loadAuditActivity();
        }

        loadData();
        const activityRefresh = window.setInterval(loadAuditActivity, 30000);
        return () => {
            active = false;
            window.clearInterval(activityRefresh);
        };
    }, [branchCode, metadataLoading, reloadKey]);

    const retry = useCallback(() => setReloadKey((k) => k + 1), []);

    /* ---------------------------------------------------------------- */
    /*  Derived                                                          */
    /* ---------------------------------------------------------------- */
    const statsLoading = loading && !stats;

    // Branch-wide truth for every number on the page.
    const totalPatients = recent.totalElements;
    const pendingCount = pending.totalElements ?? stats?.pendingVerifications ?? null;
    const verifiedCount =
        totalPatients !== null && pendingCount !== null ? Math.max(0, totalPatients - pendingCount) : null;

    const chartSource = recent.content;
    const registrationChartData = useMemo(() => buildRegistrationData(chartSource, timeRange), [chartSource, timeRange]);
    const chartTotal = registrationChartData.reduce((n, d) => n + d.patients, 0);
    const chartCapped = chartSource.length >= PAGE_SIZE;
    const chartPeak = registrationChartData.reduce(
        (best, d) => (d.patients > best.patients ? d : best),
        registrationChartData[0] ?? { name: "", patients: 0 }
    );

    const rows = worklist === "pending" ? pending.content : recent.content;
    const rowsTotal = worklist === "pending" ? pendingCount : totalPatients;

    const filteredRows = useMemo(() => {
        const q = tableSearch.trim().toLowerCase();
        if (!q) return rows;
        const qDigits = q.replace(/\s+/g, "");
        return rows.filter(
            (p) =>
                (p.fullName || "").toLowerCase().includes(q) ||
                (p.patientCode || "").toLowerCase().includes(q) ||
                (p.phone || p.phoneNumber || "").replace(/\s+/g, "").includes(qDigits) ||
                (p.identityNumber || "").toLowerCase().includes(q)
        );
    }, [rows, tableSearch]);

    const visibleRows = filteredRows.slice(0, TABLE_ROWS);
    const moreOnServer = rowsTotal !== null && rowsTotal > rows.length;

    const activityFeed = useMemo(() => (auditLogs ?? []).slice(0, ACTIVITY_ROWS).map((l) => toActivityFeedItem(l)), [auditLogs]);

    const trend = parseTrend(stats?.todayTrend);
    const todayLabel = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // backend week starts Sunday
    const weekNote = `Since ${weekStart.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`;

    const focusPendingWorklist = () => {
        setWorklist("pending");
        setTableSearch("");
        const el = worklistRef.current;
        if (!el) return;
        el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
        el.focus({ preventScroll: true });
    };

    const pendingTile = statsLoading ? null : pendingCount;

    /* ---------------------------------------------------------------- */
    /*  Render                                                           */
    /* ---------------------------------------------------------------- */
    return (
        <div className="mx-auto max-w-[1400px]">
            {/* ── Page header ── */}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl font-semibold tracking-tight text-fg">Patient overview</h1>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-fg-muted">
                        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{branchName ?? (metadataLoading ? "Loading branch…" : "No branch")}</span>
                        <span aria-hidden="true">·</span>
                        <span className="whitespace-nowrap">{todayLabel}</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button href="/patients" icon={Search}>
                        Search patients
                    </Button>
                    <Button href="/patients/new" variant="primary" icon={UserPlus}>
                        Register patient
                    </Button>
                </div>
            </div>

            {loadError && (
                <div
                    role="alert"
                    className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-status-danger-edge bg-status-danger-bg px-4 py-2.5 text-sm text-status-danger-fg"
                >
                    <span className="inline-flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {loadError}
                    </span>
                    {branchCode && (
                        <button
                            type="button"
                            onClick={retry}
                            className="rounded border border-status-danger-edge bg-surface px-2.5 py-1 text-xs font-medium text-status-danger-fg hover:bg-status-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger"
                        >
                            Retry
                        </button>
                    )}
                </div>
            )}

            {/* Screen-reader status: loading → loaded / filtered */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? "Loading dashboard"
                    : `Dashboard loaded. ${worklist === "pending" ? "Pending" : "Recent"} worklist showing ${visibleRows.length} of ${filteredRows.length} patients.`}
            </p>

            {/* ── KPI row — identical anatomy in every tile ── */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile
                    label="Registered today"
                    value={stats?.patientsRegisteredToday}
                    icon={UserCheck}
                    loading={statsLoading}
                    delta={trend ? { value: trend.value, unit: "%", label: trend.label } : undefined}
                />
                <KpiTile label="New this week" value={stats?.newPatientsThisWeek} icon={UserPlus} loading={statsLoading} note={weekNote} />
                <KpiTile
                    label="Pending verification"
                    value={pendingTile}
                    icon={ClipboardCheck}
                    tone={pendingTile ? "warning" : "neutral"}
                    loading={statsLoading}
                    onClick={focusPendingWorklist}
                    linkLabel="Open worklist"
                />
                <KpiTile
                    label="Total patients"
                    value={totalPatients}
                    icon={Users}
                    loading={loading}
                    note={
                        loading || verifiedCount === null
                            ? undefined
                            : `${verifiedCount} verified · ${pendingCount} pending`
                    }
                />
            </div>

            {/* ── Main grid: worklist first; insight column beside it only on wide screens ── */}
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-5 2xl:items-start">
                {/* Worklist */}
                <SectionCard
                    title="Patients"
                    flush
                    className="2xl:col-span-3"
                    actions={
                        <Link
                            href="/patients"
                            className="inline-flex items-center gap-0.5 rounded text-xs font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            View all
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                    }
                >
                    <section
                        ref={worklistRef}
                        tabIndex={-1}
                        aria-label="Patient worklist"
                        aria-busy={loading}
                        className="scroll-mt-24 outline-none"
                    >
                        {/* Toolbar */}
                        <div className="flex flex-wrap items-center gap-2 border-b border-edge px-3 py-2">
                            <SegmentedControl<Worklist>
                                ariaLabel="Worklist"
                                size="sm"
                                value={worklist}
                                onChange={setWorklist}
                                options={[
                                    { value: "pending", label: "Pending verification", count: pendingCount ?? undefined },
                                    { value: "recent", label: "Recent", count: totalPatients ?? undefined },
                                ]}
                            />
                            <label className="relative ml-auto block w-full max-w-[220px] min-w-[140px] flex-1 sm:flex-none">
                                <span className="sr-only">Filter loaded rows by name, MRN, NIC or phone</span>
                                <Search
                                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint"
                                    aria-hidden="true"
                                />
                                <input
                                    type="search"
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                    placeholder="Name, MRN, NIC or phone"
                                    className="h-7 w-full rounded-md border border-edge bg-surface pl-8 pr-7 text-xs text-fg placeholder:text-fg-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                {tableSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setTableSearch("")}
                                        aria-label="Clear filter"
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-muted hover:bg-surface-hover hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                        <X className="h-3 w-3" aria-hidden="true" />
                                    </button>
                                )}
                            </label>
                        </div>

                        {/* States that must not live inside the 640px-wide table */}
                        {loading ? (
                            <ul aria-hidden="true" className="divide-y divide-edge">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                        <span className="h-7 w-7 shrink-0 rounded-full bg-skeleton" />
                                        <span className="h-3 w-40 rounded bg-skeleton" />
                                        <span className="ml-auto hidden h-3 w-24 rounded bg-skeleton sm:block" />
                                        <span className="hidden h-4 w-16 rounded bg-skeleton md:block" />
                                    </li>
                                ))}
                            </ul>
                        ) : loadError ? (
                            <EmptyState
                                icon={AlertTriangle}
                                title="Worklist unavailable"
                                description={loadError}
                                compact
                                action={
                                    branchCode ? (
                                        <Button size="sm" onClick={retry}>
                                            Retry
                                        </Button>
                                    ) : undefined
                                }
                            />
                        ) : visibleRows.length === 0 ? (
                            tableSearch ? (
                                <EmptyState
                                    icon={Search}
                                    title="No loaded rows match"
                                    description={
                                        moreOnServer
                                            ? `Only the ${rows.length} most recent are loaded here — search all patients instead.`
                                            : "Try a different name, MRN, NIC or phone number."
                                    }
                                    compact
                                    action={
                                        moreOnServer ? (
                                            <Button size="sm" icon={Search} href={`/patients?keyword=${encodeURIComponent(tableSearch.trim())}`}>
                                                Search all patients
                                            </Button>
                                        ) : undefined
                                    }
                                />
                            ) : worklist === "pending" ? (
                                <EmptyState
                                    icon={ClipboardCheck}
                                    title="All caught up"
                                    description="Every patient in this branch has a verified phone or email."
                                    compact
                                />
                            ) : (
                                <EmptyState
                                    icon={Users}
                                    title="No patients yet"
                                    description="Register the first patient for this branch."
                                    compact
                                    action={
                                        <Button size="sm" icon={UserPlus} href="/patients/new">
                                            Register patient
                                        </Button>
                                    }
                                />
                            )
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] table-fixed text-left text-sm">
                                    <thead>
                                        <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                            {/*
                                              table-fixed: the percentages must leave room for the 40px Open column,
                                              i.e. sum <= 100% - 40/min-w = 93.75%. Otherwise every column is silently
                                              scaled down and the declared widths mean nothing.
                                              base (Phone hidden): 25+14+11+14+14 = 78%.
                                              lg (Phone shown):    25+14+11+15+14+14 = 93%.
                                            */}
                                            <th scope="col" className="w-[25%] py-2 pl-4 pr-3 font-semibold">Patient</th>
                                            <th scope="col" className="w-[14%] px-3 py-2 font-semibold">MRN</th>
                                            <th scope="col" className="w-[11%] px-3 py-2 font-semibold">Age / Sex</th>
                                            <th scope="col" className="hidden w-[15%] px-3 py-2 font-semibold lg:table-cell">Phone</th>
                                            <th scope="col" className="w-[14%] px-3 py-2 font-semibold">Registered</th>
                                            <th scope="col" className="w-[14%] px-3 py-2 font-semibold">Status</th>
                                            <th scope="col" className="w-10 py-2 pl-2 pr-3">
                                                <span className="sr-only">Open</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-edge whitespace-nowrap">
                                        {visibleRows.map((patient) => {
                                            const code = patient.patientCode || patient.id || "";
                                            const href = `/patients/${code}`;
                                            const status = getPatientVerification(patient);
                                            const name = patient.fullName || "Unnamed patient";
                                            const mrn = patient.patientCode || "—";
                                            const phone = formatPhone(patient.phone || patient.phoneNumber);
                                            const registered = formatRegistered(parsePatientCreatedAt(patient));
                                            return (
                                                <tr key={code} className="group transition-colors hover:bg-surface-hover">
                                                    <td className="py-2 pl-4 pr-3">
                                                        <Link
                                                            href={href}
                                                            className="flex min-w-0 items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                                        >
                                                            <span
                                                                aria-hidden="true"
                                                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-skeleton text-[12px] font-semibold text-fg-secondary"
                                                            >
                                                                {patientInitials(patient.fullName)}
                                                            </span>
                                                            <span
                                                                title={name}
                                                                className="min-w-0 truncate font-medium text-fg group-hover:text-primary-strong"
                                                            >
                                                                {name}
                                                            </span>
                                                        </Link>
                                                    </td>
                                                    <td
                                                        title={mrn === "—" ? undefined : mrn}
                                                        className="truncate px-3 py-2 font-mono text-xs text-fg-secondary"
                                                    >
                                                        {mrn}
                                                    </td>
                                                    <td className="px-3 py-2 tabular-nums text-fg-secondary">
                                                        {calculateAge(patient.dob)}
                                                        <span className="text-fg-faint"> / </span>
                                                        {formatGender(patient.gender)}
                                                    </td>
                                                    <td
                                                        title={phone === "—" ? undefined : phone}
                                                        className="hidden truncate px-3 py-2 tabular-nums text-fg-secondary lg:table-cell"
                                                    >
                                                        {phone}
                                                    </td>
                                                    <td
                                                        title={registered === "—" ? undefined : registered}
                                                        className="truncate px-3 py-2 tabular-nums text-fg-secondary"
                                                    >
                                                        {registered}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <PatientStatusBadge status={status} />
                                                    </td>
                                                    <td className="py-2 pl-2 pr-3 text-right">
                                                        <Link
                                                            href={href}
                                                            aria-label={`Open ${patient.fullName || "patient"}`}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover:text-fg-muted"
                                                        >
                                                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Footer */}
                        {!loading && !loadError && filteredRows.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge px-4 py-2 text-xs text-fg-muted">
                                <span className="tabular-nums">
                                    Showing {visibleRows.length} of {rowsTotal ?? filteredRows.length}
                                    {worklist === "pending" ? " pending" : " patients"}
                                    {tableSearch && ` · ${filteredRows.length} match the filter`}
                                </span>
                                {(filteredRows.length > TABLE_ROWS || moreOnServer) && (
                                    <Link href="/patients" className="rounded font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                        View all patients
                                    </Link>
                                )}
                            </div>
                        )}
                    </section>
                </SectionCard>

                {/* Insight column — side-by-side below 2xl, stacked beside the worklist on wide screens */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:col-span-2 2xl:grid-cols-1">
                    {/* Registrations chart */}
                    <SectionCard
                        title="Registrations"
                        actions={
                            <SegmentedControl<TimeRange>
                                ariaLabel="Chart time range"
                                size="sm"
                                value={timeRange}
                                onChange={setTimeRange}
                                options={RANGE_OPTIONS}
                            />
                        }
                        bodyClassName="px-2 pb-2 pt-3"
                    >
                        <figure className="m-0">
                            <figcaption className="sr-only">
                                {loading
                                    ? "Loading registrations chart"
                                    : `${chartTotal} registrations ${RANGE_DESCRIPTIONS[timeRange]}${
                                          chartTotal > 0 ? `, peak ${chartPeak.name} with ${chartPeak.patients}` : ""
                                      }.`}
                            </figcaption>
                            <div className="h-44" aria-hidden="true">
                                {loading ? (
                                    <div className="flex h-full items-end gap-2 px-4 pb-6">
                                        {[40, 65, 30, 80, 55, 45, 70].map((h, i) => (
                                            <span key={i} className="flex-1 rounded-t bg-skeleton" style={{ height: `${h}%` }} />
                                        ))}
                                    </div>
                                ) : chartTotal > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={registrationChartData} barSize={22} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" vertical={false} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--fg-muted)" }} interval="preserveStartEnd" />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--fg-muted)" }} allowDecimals={false} width={40} />
                                            <Tooltip
                                                cursor={{ fill: "var(--primary-soft)" }}
                                                contentStyle={{
                                                    borderRadius: 6,
                                                    border: "1px solid var(--edge)",
                                                    background: "var(--surface)",
                                                    color: "var(--fg)",
                                                    boxShadow: "0 2px 8px rgb(15 23 42 / 0.12)",
                                                    fontSize: 12,
                                                    padding: "6px 10px",
                                                }}
                                                itemStyle={{ color: "var(--fg)" }}
                                                labelStyle={{ color: "var(--fg-muted)" }}
                                                formatter={(value) => [value, "Registrations"]}
                                            />
                                            <Bar dataKey="patients" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="Registrations" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <EmptyState
                                        icon={BarChart3}
                                        title={timeRange === "today" ? "No registrations yet today" : "No registrations in the last 7 days"}
                                        description="New registrations will appear here as they happen."
                                        compact
                                        className="h-full"
                                    />
                                )}
                            </div>
                            {!loading && chartCapped && (
                                <p className="px-2 pt-1 text-[12px] text-fg-muted">
                                    Based on the {PAGE_SIZE} most recent registrations.
                                </p>
                            )}
                        </figure>
                    </SectionCard>

                    {/* Recent activity */}
                    <SectionCard
                        title="Recent activity"
                        flush
                        actions={
                            <Link
                                href="/audit"
                                className="inline-flex items-center gap-0.5 rounded text-xs font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                Audit log
                                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                        }
                    >
                        {auditLogs === null ? (
                            <ul aria-hidden="true" className="divide-y divide-edge">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <li key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-skeleton" />
                                        <span className="flex-1 space-y-1.5">
                                            <span className="block h-3 w-3/4 rounded bg-skeleton" />
                                            <span className="block h-2.5 w-1/3 rounded bg-skeleton" />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : activityFeed.length === 0 ? (
                            <EmptyState
                                icon={Activity}
                                title="No recent activity"
                                description="Registrations, edits and verifications will show up here."
                                compact
                            />
                        ) : (
                            <ol className="divide-y divide-edge">
                                {activityFeed.map((item) => (
                                    <li key={item.id} className="flex items-start gap-2.5 px-4 py-2">
                                        <span
                                            aria-hidden="true"
                                            className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", ACTIVITY_DOT[item.kind])}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-fg">
                                                {item.patientCode ? (
                                                    <Link
                                                        href={`/patients/${item.patientCode}`}
                                                        className="rounded hover:text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                    >
                                                        {item.message}
                                                    </Link>
                                                ) : (
                                                    item.message
                                                )}
                                                {item.ref && (
                                                    <code
                                                        title={item.refFull}
                                                        className="ml-1.5 rounded bg-surface-muted px-1.5 py-px align-middle font-mono text-[12px] font-medium text-fg-secondary ring-1 ring-inset ring-edge"
                                                    >
                                                        {item.ref}
                                                    </code>
                                                )}
                                            </p>
                                            <p className="mt-0.5 text-xs text-fg-muted">
                                                <span className="tabular-nums">{item.time}</span>
                                                {item.actor && (
                                                    <>
                                                        <span aria-hidden="true"> · </span>
                                                        <span>{item.actor}</span>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}
