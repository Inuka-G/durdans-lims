"use client";

import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AlertTriangle, FileSpreadsheet, Globe, History, Radio, SearchX, ShieldX, X } from "lucide-react";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { InputField, SelectField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import KpiTile from "@/components/ui/KpiTile";
import StatusChip, { humanizeStatus, toneForStatus, type ChipTone } from "@/components/ui/StatusChip";
import Pagination from "@/components/ui/Pagination";
import DemoDataBanner from "@/components/shared/DemoDataBanner";
import { formatAuditTime } from "@/components/patient-dashboard/dashboard-data";

const PAGE_SIZE = 10;

// Mock Data for Global Audit Trail
const MOCK_LOGS = [
    {
        id: "LOG-5001",
        timestamp: "Oct 27, 2023 11:15 AM",
        user: "Admin",
        role: "Super Admin",
        branch: "Global",
        module: "System Setting",
        action: "Modify Configuration",
        entityId: "CFG-SEC-01",
        status: "WARNING",
        ipAddress: "10.0.0.1",
    },
    {
        id: "LOG-5002",
        timestamp: "Oct 27, 2023 10:45 AM",
        user: "Nimal Kuruppu",
        role: "Branch Head",
        branch: "Colombo",
        module: "User Management",
        action: "Update Role",
        entityId: "USR-00125",
        status: "SUCCESS",
        ipAddress: "192.168.1.45",
    },
    {
        id: "LOG-5003",
        timestamp: "Oct 27, 2023 10:42 AM",
        user: "System",
        role: "System",
        branch: "Global",
        module: "Authentication",
        action: "Failed Login",
        entityId: "-",
        status: "FAILED",
        ipAddress: "103.24.11.2",
    },
    {
        id: "LOG-5004",
        timestamp: "Oct 27, 2023 10:30 AM",
        user: "Sunil Perera",
        role: "Lab Technician",
        branch: "Kandy",
        module: "Lab Reports",
        action: "Upload Result",
        entityId: "RPT-88219",
        status: "SUCCESS",
        ipAddress: "192.168.2.50",
    },
    {
        id: "LOG-5005",
        timestamp: "Oct 27, 2023 10:15 AM",
        user: "Dr. Samantha Gunaratne",
        role: "Consultant",
        branch: "Colombo",
        module: "Patient Records",
        action: "View History",
        entityId: "PAT-110293",
        status: "SUCCESS",
        ipAddress: "192.168.1.22",
    },
    {
        id: "LOG-5006",
        timestamp: "Oct 26, 2023 4:45 PM",
        user: "Nilani Fernando",
        role: "Nursing Head",
        branch: "Galle",
        module: "Inventory",
        action: "Approve Stock",
        entityId: "INV-REQ-991",
        status: "SUCCESS",
        ipAddress: "192.168.3.14",
    },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Audit outcome → chip tone. FAILED comes from the shared STATUS_TONE map. */
const LOG_STATUS_TONE: Record<string, ChipTone> = {
    SUCCESS: "success",
    WARNING: "pending",
};

function toneForLogStatus(status: string): ChipTone {
    return LOG_STATUS_TONE[status.toUpperCase()] ?? toneForStatus(status);
}

/** Full, unambiguous timestamp for tooltips. */
function formatFullTimestamp(ts: string): string {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts || "—";
    return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

/** "09:12" (24h) for the secondary time line on non-relative dates. */
function formatClock(ts: string): string | null {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function GlobalAuditTrailsPage() {
    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("All Branches");
    const [selectedRole, setSelectedRole] = useState("All Roles");
    const [selectedModule, setSelectedModule] = useState("All Modules");
    const [selectedAction, setSelectedAction] = useState("All Actions");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    // 1-based client-side paging over the filtered mock list
    const [page, setPage] = useState(1);

    // Filter logic
    const filteredLogs = MOCK_LOGS.filter(log => {
        // Search Filter (User, Entity ID, IP)
        const query = searchQuery.toLowerCase();
        const matchesSearch = log.user.toLowerCase().includes(query) ||
            log.entityId.toLowerCase().includes(query) ||
            log.ipAddress.toLowerCase().includes(query);

        // Dropdown Filters
        const matchesBranch = selectedBranch === "All Branches" || log.branch === selectedBranch;
        const matchesRole = selectedRole === "All Roles" || log.role === selectedRole;
        const matchesModule = selectedModule === "All Modules" || log.module === selectedModule;
        const matchesAction = selectedAction === "All Actions" || log.action === selectedAction;

        // Date Filter
        let matchesDate = true;
        if (startDate || endDate) {
            const logDate = new Date(log.timestamp);
            if (!isNaN(logDate.getTime())) {
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    matchesDate = matchesDate && logDate >= start;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    matchesDate = matchesDate && logDate <= end;
                }
            }
        }

        return matchesSearch && matchesBranch && matchesRole && matchesModule && matchesAction && matchesDate;
    });

    const uniqueBranches = ["All Branches", ...Array.from(new Set(MOCK_LOGS.map(log => log.branch)))];
    const uniqueRoles = ["All Roles", ...Array.from(new Set(MOCK_LOGS.map(log => log.role)))];
    const uniqueModules = ["All Modules", ...Array.from(new Set(MOCK_LOGS.map(log => log.module)))];
    const uniqueActions = ["All Actions", ...Array.from(new Set(MOCK_LOGS.map(log => log.action)))];

    const hasFilters = Boolean(
        searchQuery ||
            startDate ||
            endDate ||
            selectedBranch !== "All Branches" ||
            selectedRole !== "All Roles" ||
            selectedModule !== "All Modules" ||
            selectedAction !== "All Actions"
    );

    const clearFilters = () => {
        setSearchQuery("");
        setStartDate("");
        setEndDate("");
        setSelectedBranch("All Branches");
        setSelectedRole("All Roles");
        setSelectedModule("All Modules");
        setSelectedAction("All Actions");
        setPage(1);
    };

    /** Wrap a filter setter so any change returns to the first page. */
    const withPageReset =
        (setter: (value: string) => void) =>
        (value: string) => {
            setter(value);
            setPage(1);
        };

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageRows = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const handleExportExcel = () => {
        if (filteredLogs.length === 0) {
            toast.message("No logs to export based on current filters.");
            return;
        }

        const headers = ["Timestamp", "User", "Role", "Branch", "Module", "Action", "Entity ID", "Status", "IP Address"];
        const rows = filteredLogs.map((log) => [
            log.timestamp,
            log.user,
            log.role,
            log.branch,
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
        XLSX.utils.book_append_sheet(workbook, worksheet, "Global Audit Logs");
        XLSX.writeFile(workbook, `Global_Audit_Logs_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="mx-auto w-full max-w-[1400px]">
            <PageHeader
                title="Audit trails"
                crumbs={[{ label: "System" }, { label: "Global administration" }, { label: "Audit trails" }]}
                meta={
                    <>
                        <History className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Security events, user actions and administrative changes across all branches</span>
                        <span aria-hidden="true">·</span>
                        <span>Log retention 180 days</span>
                    </>
                }
                actions={
                    <Button variant="primary" icon={FileSpreadsheet} onClick={handleExportExcel}>
                        Export to Excel
                    </Button>
                }
            />

            <DemoDataBanner note="Demo data — this audit trail is not yet connected to a live backend; entries and metrics are placeholders." />

            {/* Screen-reader status for filter changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {`${filteredLogs.length} of ${MOCK_LOGS.length} audit ${MOCK_LOGS.length === 1 ? "entry" : "entries"} shown${
                    totalPages > 1 ? `, page ${currentPage} of ${totalPages}` : ""
                }.`}
            </p>

            {/* KPI row */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile label="Global actions" value="84,204" icon={Globe} note="Past 30 days" />
                <KpiTile label="Failed logins" value="412" icon={ShieldX} tone="danger" delta={{ value: 12, label: "vs previous 30 days" }} />
                <KpiTile label="Critical incidents" value="42" icon={AlertTriangle} tone="warning" note="Requires audit" />
                <KpiTile label="Active sessions" value="1,248" icon={Radio} tone="success" note="Across 12 nodes" />
            </div>

            <SectionCard title="System audit trail" count={filteredLogs.length} flush>
                {/* Filter toolbar */}
                <div className="border-b border-edge bg-surface-muted px-3 py-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
                        <InputField
                            label="Search"
                            type="search"
                            value={searchQuery}
                            onChange={(e) => withPageReset(setSearchQuery)(e.target.value)}
                            placeholder="User, entity id or IP address"
                            autoComplete="off"
                            className="sm:col-span-2"
                        />
                        <InputField
                            label="From date"
                            type="date"
                            value={startDate}
                            onChange={(e) => withPageReset(setStartDate)(e.target.value)}
                        />
                        <InputField
                            label="To date"
                            type="date"
                            value={endDate}
                            onChange={(e) => withPageReset(setEndDate)(e.target.value)}
                        />
                        <SelectField label="Branch" value={selectedBranch} onChange={(e) => withPageReset(setSelectedBranch)(e.target.value)}>
                            {uniqueBranches.map(branch => (
                                <option key={branch} value={branch}>
                                    {branch === "All Branches" ? "All branches" : branch}
                                </option>
                            ))}
                        </SelectField>
                        <SelectField label="User role" value={selectedRole} onChange={(e) => withPageReset(setSelectedRole)(e.target.value)}>
                            {uniqueRoles.map(role => (
                                <option key={role} value={role}>
                                    {role === "All Roles" ? "All roles" : role}
                                </option>
                            ))}
                        </SelectField>
                        <SelectField label="Module" value={selectedModule} onChange={(e) => withPageReset(setSelectedModule)(e.target.value)}>
                            {uniqueModules.map(mod => (
                                <option key={mod} value={mod}>
                                    {mod === "All Modules" ? "All modules" : mod}
                                </option>
                            ))}
                        </SelectField>
                        <SelectField label="Action type" value={selectedAction} onChange={(e) => withPageReset(setSelectedAction)(e.target.value)}>
                            {uniqueActions.map(action => (
                                <option key={action} value={action}>
                                    {action === "All Actions" ? "All actions" : action}
                                </option>
                            ))}
                        </SelectField>
                        {hasFilters && (
                            <div className="flex items-end sm:col-span-2 lg:col-span-4 lg:justify-end">
                                <Button variant="ghost" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Empty state lives outside the table so it centres on small screens */}
                {filteredLogs.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="No entries match"
                            description="Try a different search term, date range, branch, role, module or action."
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
                            description="Security events, user actions and administrative changes will be recorded here."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        {/* table-fixed: min-w must clear the fixed columns + a 160px floor for the auto
                            Action column at every band (base/md 544, lg 688, xl 832). */}
                        <table className="w-full min-w-[760px] table-fixed text-left text-sm lg:min-w-[860px] xl:min-w-[1000px]">
                            <caption className="sr-only">System audit trail entries</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-32 py-2 pl-4 pr-3 font-semibold">
                                        Time
                                    </th>
                                    <th scope="col" className="w-48 px-3 py-2 font-semibold">
                                        User
                                    </th>
                                    <th scope="col" className="hidden w-28 px-3 py-2 font-semibold md:table-cell">
                                        Branch
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-semibold">
                                        Action
                                    </th>
                                    <th scope="col" className="hidden w-36 px-3 py-2 font-semibold lg:table-cell">
                                        Entity id
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
                                {pageRows.map((log) => {
                                    const relative = formatAuditTime(log.timestamp);
                                    const clock = formatClock(log.timestamp);
                                    // Relative labels ("Today 09:12", "2h ago") already carry the time.
                                    const showClock = clock !== null && !relative.includes(":") && !relative.endsWith("ago") && relative !== "Just now";
                                    const fullTime = formatFullTimestamp(log.timestamp);
                                    return (
                                        <tr key={log.id} className="transition-colors hover:bg-surface-hover">
                                            {/* Time */}
                                            <td className="py-2 pl-4 pr-3 tabular-nums text-fg-secondary">
                                                <span title={fullTime}>{relative}</span>
                                                {showClock && <span className="block text-xs text-fg-muted">{clock}</span>}
                                            </td>
                                            {/* User */}
                                            <td className="px-3 py-2">
                                                <span className="block truncate font-medium text-fg" title={log.user}>
                                                    {log.user}
                                                </span>
                                                <span className="block truncate text-xs text-fg-muted">{log.role}</span>
                                            </td>
                                            {/* Branch */}
                                            <td className="hidden px-3 py-2 md:table-cell">
                                                <StatusChip tone={log.branch === "Global" ? "info" : "neutral"} size="sm" title={log.branch}>
                                                    {log.branch}
                                                </StatusChip>
                                            </td>
                                            {/* Module / action */}
                                            <td className="px-3 py-2">
                                                <span className="block truncate text-fg" title={log.action}>
                                                    {log.action}
                                                </span>
                                                <span className="block truncate text-xs text-fg-muted">{log.module}</span>
                                            </td>
                                            {/* Entity id */}
                                            <td className="hidden px-3 py-2 font-mono text-xs lg:table-cell">
                                                {log.entityId && log.entityId !== "-" ? (
                                                    <span
                                                        title={log.entityId}
                                                        className="inline-block max-w-full truncate rounded bg-surface-muted px-1.5 py-0.5 align-middle text-fg-secondary ring-1 ring-inset ring-edge select-all"
                                                    >
                                                        {log.entityId}
                                                    </span>
                                                ) : (
                                                    <span className="text-fg-faint">—</span>
                                                )}
                                            </td>
                                            {/* Status */}
                                            <td className="px-3 py-2">
                                                <StatusChip tone={toneForLogStatus(log.status)} dot size="sm">
                                                    {humanizeStatus(log.status)}
                                                </StatusChip>
                                            </td>
                                            {/* IP */}
                                            <td className="hidden truncate px-3 py-2 font-mono text-xs text-fg-muted xl:table-cell" title={log.ipAddress}>
                                                {log.ipAddress}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {filteredLogs.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredLogs.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={setPage}
                        itemLabel={filteredLogs.length === 1 ? "entry" : "entries"}
                    />
                )}
            </SectionCard>

            <p className="mt-4 text-xs text-fg-muted">&copy; 2023 Durdans Hospital &middot; Global Admin Suite v3.1.0</p>
        </div>
    );
}
