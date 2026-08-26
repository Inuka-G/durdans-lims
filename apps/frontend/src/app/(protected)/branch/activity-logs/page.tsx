"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
    Activity,
    AlertTriangle,
    Building2,
    FileSpreadsheet,
    History,
    LogIn,
    RefreshCw,
    Search,
    Users,
    X,
} from "lucide-react";
import { getAuditLogs, getMetadata, type AuditLog } from "@/lib/api";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { InputField, SelectField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import KpiTile from "@/components/ui/KpiTile";
import StatusChip, { humanizeStatus, type ChipTone } from "@/components/ui/StatusChip";
import Pagination from "@/components/ui/Pagination";
import { formatAuditTime } from "@/components/patient-dashboard/dashboard-data";

type LogStatus = "SUCCESS" | "FAILED" | "WARNING";

type ActivityLogRow = {
    id: string;
    rawTimestamp: string;
    timestamp: string;
    user: string;
    role: string;
    module: string;
    action: string;
    entityId: string;
    status: LogStatus;
    ipAddress: string;
};

/** Rows fetched from the API per refresh (filtered client-side). */
const PAGE_SIZE = 200;
/** Rows shown per table page (client-side pagination over the filtered set). */
const TABLE_PAGE_SIZE = 25;
const SKELETON_ROWS = 8;
const REFRESH_INTERVAL_MS = 30000;

/** Sentinel values for the "all" options — kept as-is so filter state semantics don't change. */
const ALL_ROLES = "All Roles";
const ALL_MODULES = "All Modules";
const ALL_ACTIONS = "All Actions";

const LOG_STATUS_TONE: Record<LogStatus, ChipTone> = {
    SUCCESS: "success",
    FAILED: "danger",
    WARNING: "pending",
};

const ROLE_BY_ENTITY: Record<string, string> = {
    PATIENT: "Front Desk Officer",
    PATIENT_DOCUMENT: "Front Desk Officer",
    PROFILE_PHOTO: "Front Desk Officer",
    VERIFICATION: "Senior MLT",
    ORDER: "Billing Officer",
    BILL: "Billing Officer",
    PAYMENT: "Billing Officer",
    REVENUE_REPORT: "Billing Officer",
    SAMPLE_COLLECTION: "Phlebotomist",
    SAMPLE_ACCESSIONING: "Lab Receptionist",
    TEST_RESULT: "MLT",
    CLINICAL_AUTHORIZATION: "Doctor",
    REPORT_DISPATCH: "Dispatch Officer",
};

function parseDetails(details?: string): Record<string, unknown> | null {
    if (!details) return null;

    try {
        const parsed = JSON.parse(details);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

function getDetail(details: Record<string, unknown> | null, key: string) {
    const value = details?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : "";
}

function formatLabel(value?: string | null) {
    if (!value) return "-";

    return value
        .replace(/_/g, " ")
        .toLowerCase()
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/** Full timestamp used for the Excel export and row tooltips. */
function formatTimestamp(value?: string) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-LK", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function inferRole(log: AuditLog) {
    const actor = log.performedBy?.trim();
    if (!actor || actor.toUpperCase() === "SYSTEM") return "System";

    const entityType = log.entityType?.toUpperCase();
    if (entityType && ROLE_BY_ENTITY[entityType]) return ROLE_BY_ENTITY[entityType];

    const action = log.action?.toUpperCase() ?? "";
    if (action.includes("CLINICAL") || action.includes("AUTHORIZE")) return "Doctor";
    if (action.includes("VERIFY")) return "Senior MLT";
    if (action.includes("DISPATCH") || action.includes("DELIVER")) return "Dispatch Officer";
    if (action.includes("ORDER") || action.includes("BILL") || action.includes("PAYMENT")) return "Billing Officer";

    return "Branch Staff";
}

function inferStatus(action?: string): LogStatus {
    const normalized = action?.toUpperCase() ?? "";
    if (/(FAILED|FAILURE|ERROR|DENIED|REJECTED)/.test(normalized)) return "FAILED";
    if (/(WARNING|CANCEL|RETURN|RETRY|OVERRIDE)/.test(normalized)) return "WARNING";
    return "SUCCESS";
}

function toModule(entityType?: string) {
    const type = entityType?.toUpperCase();
    if (!type) return "System";

    const moduleByEntity: Record<string, string> = {
        PATIENT: "Patient Records",
        PATIENT_DOCUMENT: "Patient Documents",
        PROFILE_PHOTO: "Patient Profile",
        VERIFICATION: "Verification",
        ORDER: "Orders",
        BILL: "Billing",
        PAYMENT: "Payments",
        REVENUE_REPORT: "Revenue Reports",
        SAMPLE_COLLECTION: "Sample Collection",
        SAMPLE_ACCESSIONING: "Sample Accessioning",
        TEST_RESULT: "Lab Results",
        CLINICAL_AUTHORIZATION: "Clinical Authorization",
        REPORT_DISPATCH: "Report Dispatch",
    };

    return moduleByEntity[type] ?? formatLabel(type);
}

function toEntityId(log: AuditLog) {
    const details = parseDetails(log.details);
    return (
        log.patientCode ||
        log.entityId ||
        getDetail(details, "orderId") ||
        getDetail(details, "reportReference") ||
        getDetail(details, "sampleId") ||
        "-"
    );
}

function toRow(log: AuditLog): ActivityLogRow {
    return {
        id: log.id || `${log.action}-${log.timestamp}`,
        rawTimestamp: log.timestamp,
        timestamp: formatTimestamp(log.timestamp),
        user: log.performedBy || "SYSTEM",
        role: inferRole(log),
        module: toModule(log.entityType),
        action: formatLabel(log.action),
        entityId: toEntityId(log),
        status: inferStatus(log.action),
        ipAddress: log.ipAddress || "-",
    };
}

function isWithinDateRange(log: ActivityLogRow, startDate: string, endDate: string) {
    if (!startDate && !endDate) return true;

    const logDate = new Date(log.rawTimestamp);
    if (Number.isNaN(logDate.getTime())) return true;

    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (logDate < start) return false;
    }

    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (logDate > end) return false;
    }

    return true;
}

/** Renders "-" placeholders from the row model as a muted dash. */
function Cell({ value, mono = false }: { value: string; mono?: boolean }) {
    if (!value || value === "-") return <span className="text-fg-faint">—</span>;
    return <span className={mono ? "font-mono text-xs" : undefined}>{value}</span>;
}

export default function ActivityLogsPage() {
    const [branchName, setBranchName] = useState("Durdans Branch");
    const [logs, setLogs] = useState<ActivityLogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error, setError] = useState("");

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRole, setSelectedRole] = useState(ALL_ROLES);
    const [selectedModule, setSelectedModule] = useState(ALL_MODULES);
    const [selectedAction, setSelectedAction] = useState(ALL_ACTIONS);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [tablePage, setTablePage] = useState(1);

    const loadLogs = useCallback(async () => {
        try {
            setLoading(true);

            const [metadata, auditData] = await Promise.all([
                getMetadata().catch(() => null),
                getAuditLogs({ page: 0, size: PAGE_SIZE }),
            ]);

            setBranchName(metadata?.currentBranchName || "Durdans Branch");
            setLogs((auditData.content || []).map(toRow));
            // Clear a previous failure only once fresh data has arrived, so the
            // error state (with its spinning Retry button) stays visible while
            // a retry is in flight instead of flashing "No activity yet".
            setError("");
        } catch (loadError) {
            console.error("Failed to load branch activity logs", loadError);
            setError("Couldn't load branch activity logs. Check your connection and retry.");
            setLogs([]);
        } finally {
            setLoading(false);
            setHasLoaded(true);
        }
    }, []);

    useEffect(() => {
        void loadLogs();
        const refresh = window.setInterval(loadLogs, REFRESH_INTERVAL_MS);

        return () => window.clearInterval(refresh);
    }, [loadLogs]);

    const filteredLogs = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return logs.filter((log) => {
            const matchesSearch =
                !query ||
                log.user.toLowerCase().includes(query) ||
                log.entityId.toLowerCase().includes(query) ||
                log.ipAddress.toLowerCase().includes(query) ||
                log.action.toLowerCase().includes(query);
            const matchesRole = selectedRole === ALL_ROLES || log.role === selectedRole;
            const matchesModule = selectedModule === ALL_MODULES || log.module === selectedModule;
            const matchesAction = selectedAction === ALL_ACTIONS || log.action === selectedAction;

            return (
                matchesSearch &&
                matchesRole &&
                matchesModule &&
                matchesAction &&
                isWithinDateRange(log, startDate, endDate)
            );
        });
    }, [endDate, logs, searchQuery, selectedAction, selectedModule, selectedRole, startDate]);

    const uniqueRoles = useMemo(() => [ALL_ROLES, ...Array.from(new Set(logs.map((log) => log.role)))], [logs]);
    const uniqueModules = useMemo(() => [ALL_MODULES, ...Array.from(new Set(logs.map((log) => log.module)))], [logs]);
    const uniqueActions = useMemo(() => [ALL_ACTIONS, ...Array.from(new Set(logs.map((log) => log.action)))], [logs]);

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const totalActionsLastSevenDays = logs.filter((log) => {
        const date = new Date(log.rawTimestamp);
        return !Number.isNaN(date.getTime()) && date >= sevenDaysAgo;
    }).length;
    const failedLogins = logs.filter((log) => log.status === "FAILED" && log.action.toLowerCase().includes("login")).length;
    const criticalActions = logs.filter((log) => log.status === "FAILED" || log.status === "WARNING").length;
    const activeUsers = new Set(logs.map((log) => log.user).filter((user) => user && user.toUpperCase() !== "SYSTEM")).size;

    // Client-side paging over the filtered set. The page is clamped so a
    // background refresh that shrinks the list never strands the user on an
    // empty page.
    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / TABLE_PAGE_SIZE));
    const currentPage = Math.min(tablePage, totalPages);
    const pageRows = filteredLogs.slice((currentPage - 1) * TABLE_PAGE_SIZE, currentPage * TABLE_PAGE_SIZE);

    const hasFilters =
        Boolean(searchQuery) ||
        selectedRole !== ALL_ROLES ||
        selectedModule !== ALL_MODULES ||
        selectedAction !== ALL_ACTIONS ||
        Boolean(startDate) ||
        Boolean(endDate);

    const clearFilters = () => {
        setSearchQuery("");
        setSelectedRole(ALL_ROLES);
        setSelectedModule(ALL_MODULES);
        setSelectedAction(ALL_ACTIONS);
        setStartDate("");
        setEndDate("");
        setTablePage(1);
    };

    const handleExportExcel = () => {
        if (filteredLogs.length === 0) {
            toast.message("No logs to export based on current filters.");
            return;
        }

        const headers = ["Timestamp", "User", "Role", "Module", "Action", "Entity ID", "Status", "IP Address"];
        const rows = filteredLogs.map((log) => [
            log.timestamp,
            log.user,
            log.role,
            log.module,
            log.action,
            log.entityId,
            log.status,
            log.ipAddress,
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const colWidths = headers.map((h, i) => ({
            wch: Math.min(Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)) + 2, 50),
        }));
        worksheet["!cols"] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Activity Logs");
        XLSX.writeFile(workbook, `Activity_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const initialLoading = loading && !hasLoaded;
    const refreshing = loading && hasLoaded;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Activity logs"
                crumbs={[{ label: "Branch", href: "/branch" }, { label: "Activity logs" }]}
                meta={
                    <>
                        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{branchName}</span>
                        <span aria-hidden="true">·</span>
                        <span>Branch workflow, user actions and security events</span>
                        <span aria-hidden="true">·</span>
                        <span>Refreshes every 30 s</span>
                    </>
                }
                actions={
                    <>
                        <Button icon={FileSpreadsheet} onClick={handleExportExcel} disabled={initialLoading}>
                            Export Excel
                        </Button>
                        <Button icon={RefreshCw} onClick={() => void loadLogs()} loading={refreshing}>
                            Refresh
                        </Button>
                    </>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {initialLoading
                    ? "Loading branch activity logs"
                    : error
                      ? "Branch activity logs failed to load"
                      : `Branch activity logs loaded. Showing ${pageRows.length} of ${filteredLogs.length} entries${
                            totalPages > 1 ? `, page ${currentPage} of ${totalPages}` : ""
                        }.`}
            </p>

            {/* Summary tiles */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile
                    label="Actions, last 7 days"
                    value={totalActionsLastSevenDays.toLocaleString()}
                    icon={Activity}
                    loading={initialLoading}
                    note="From the latest audit entries"
                />
                <KpiTile
                    label="Failed logins"
                    value={failedLogins.toLocaleString()}
                    icon={LogIn}
                    tone={failedLogins > 0 ? "danger" : "neutral"}
                    loading={initialLoading}
                    note={failedLogins > 0 ? "Needs review" : "No failures recorded"}
                />
                <KpiTile
                    label="Critical actions"
                    value={criticalActions.toLocaleString()}
                    icon={AlertTriangle}
                    tone={criticalActions > 0 ? "warning" : "neutral"}
                    loading={initialLoading}
                    note="Failed or warning-level actions"
                />
                <KpiTile
                    label="Active users"
                    value={activeUsers.toLocaleString()}
                    icon={Users}
                    loading={initialLoading}
                    note="Distinct users in loaded entries"
                />
            </div>

            <SectionCard title="Audit trail" count={hasLoaded && !error ? filteredLogs.length.toLocaleString() : undefined} flush>
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <InputField
                        label="Search activity logs"
                        hideLabel
                        type="search"
                        value={searchQuery}
                        onChange={(event) => {
                            setSearchQuery(event.target.value);
                            setTablePage(1);
                        }}
                        placeholder="Search user, entity ID, action or IP address"
                        autoComplete="off"
                        className="min-w-[200px] flex-1"
                    />
                    <SelectField
                        label="User role"
                        hideLabel
                        value={selectedRole}
                        onChange={(event) => {
                            setSelectedRole(event.target.value);
                            setTablePage(1);
                        }}
                        className="w-full sm:w-44"
                    >
                        {uniqueRoles.map((role) => (
                            <option key={role} value={role}>
                                {role === ALL_ROLES ? "All roles" : role}
                            </option>
                        ))}
                    </SelectField>
                    <SelectField
                        label="Module"
                        hideLabel
                        value={selectedModule}
                        onChange={(event) => {
                            setSelectedModule(event.target.value);
                            setTablePage(1);
                        }}
                        className="w-full sm:w-44"
                    >
                        {uniqueModules.map((module) => (
                            <option key={module} value={module}>
                                {module === ALL_MODULES ? "All modules" : module}
                            </option>
                        ))}
                    </SelectField>
                    <SelectField
                        label="Action type"
                        hideLabel
                        value={selectedAction}
                        onChange={(event) => {
                            setSelectedAction(event.target.value);
                            setTablePage(1);
                        }}
                        className="w-full sm:w-44"
                    >
                        {uniqueActions.map((action) => (
                            <option key={action} value={action}>
                                {action === ALL_ACTIONS ? "All actions" : action}
                            </option>
                        ))}
                    </SelectField>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <InputField
                            label="From date"
                            hideLabel
                            type="date"
                            value={startDate}
                            onChange={(event) => {
                                setStartDate(event.target.value);
                                setTablePage(1);
                            }}
                            className="w-[8.75rem]"
                        />
                        <span className="text-xs text-fg-muted" aria-hidden="true">
                            to
                        </span>
                        <InputField
                            label="To date"
                            hideLabel
                            type="date"
                            value={endDate}
                            onChange={(event) => {
                                setEndDate(event.target.value);
                                setTablePage(1);
                            }}
                            className="w-[8.75rem]"
                        />
                    </div>
                    {hasFilters && (
                        <Button variant="ghost" icon={X} onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </div>

                {/* States live outside the table so they centre on small screens */}
                {initialLoading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-20 shrink-0 rounded bg-skeleton" />
                                <span className="h-4 w-28 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-28 rounded bg-skeleton md:block" />
                                <span className="hidden h-3 w-28 rounded bg-skeleton lg:block" />
                                <span className="h-3 w-1/4 rounded bg-skeleton" />
                                <span className="h-3 w-24 rounded bg-skeleton" />
                                <span className="h-4 w-16 rounded bg-skeleton" />
                                <span className="ml-auto hidden h-3 w-24 rounded bg-skeleton xl:block" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Activity logs unavailable"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => void loadLogs()} loading={loading}>
                                Retry
                            </Button>
                        }
                    />
                ) : filteredLogs.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={Search}
                            title="No entries match"
                            description="Try a different search term, role, module, action or date range."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={History}
                            title="No activity yet"
                            description="Branch workflow, user actions and security events will be recorded here."
                        />
                    )
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1200px] table-fixed text-left text-sm">
                                <caption className="sr-only">Branch activity log entries</caption>
                                <thead>
                                    <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                        <th scope="col" className="w-32 py-2 pl-4 pr-3 font-semibold">
                                            Time
                                        </th>
                                        <th scope="col" className="w-40 px-3 py-2 font-semibold">
                                            User
                                        </th>
                                        <th scope="col" className="hidden w-40 px-3 py-2 font-semibold md:table-cell">
                                            Role
                                        </th>
                                        <th scope="col" className="hidden w-44 px-3 py-2 font-semibold lg:table-cell">
                                            Module
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                            Action
                                        </th>
                                        <th scope="col" className="w-36 px-3 py-2 font-semibold">
                                            Entity ID
                                        </th>
                                        <th scope="col" className="w-28 px-3 py-2 font-semibold">
                                            Status
                                        </th>
                                        <th scope="col" className="hidden w-36 px-3 py-2 font-semibold xl:table-cell">
                                            IP address
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {pageRows.map((log, index) => (
                                        <tr key={`${log.id}-${index}`} className="transition-colors hover:bg-surface-hover">
                                            <td className="py-2 pl-4 pr-3 tabular-nums text-fg-secondary">
                                                <time dateTime={log.rawTimestamp} title={log.timestamp}>
                                                    {formatAuditTime(log.rawTimestamp)}
                                                </time>
                                            </td>
                                            <td className="truncate px-3 py-2 font-medium text-fg" title={log.user}>
                                                {log.user}
                                            </td>
                                            <td className="hidden truncate px-3 py-2 text-fg-secondary md:table-cell" title={log.role}>
                                                {log.role}
                                            </td>
                                            <td className="hidden truncate px-3 py-2 text-fg-secondary lg:table-cell" title={log.module}>
                                                {log.module}
                                            </td>
                                            <td className="truncate px-3 py-2 text-fg" title={log.action}>
                                                {log.action}
                                            </td>
                                            <td className="truncate px-3 py-2 text-fg-muted" title={log.entityId !== "-" ? log.entityId : undefined}>
                                                <Cell value={log.entityId} mono />
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusChip tone={LOG_STATUS_TONE[log.status]} dot size="sm">
                                                    {humanizeStatus(log.status)}
                                                </StatusChip>
                                            </td>
                                            <td className="hidden truncate px-3 py-2 text-fg-muted xl:table-cell">
                                                <Cell value={log.ipAddress} mono />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredLogs.length}
                            pageSize={TABLE_PAGE_SIZE}
                            onPageChange={setTablePage}
                            itemLabel={filteredLogs.length === 1 ? "entry" : "entries"}
                        />
                    </>
                )}
            </SectionCard>
        </div>
    );
}
