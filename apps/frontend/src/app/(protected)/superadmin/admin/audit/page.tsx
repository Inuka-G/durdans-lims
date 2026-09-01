"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AlertTriangle, FileSpreadsheet, Globe, History, Radio, SearchX, ShieldX, X, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { InputField, SelectField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import KpiTile from "@/components/ui/KpiTile";
import StatusChip, { humanizeStatus, toneForStatus, type ChipTone } from "@/components/ui/StatusChip";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import { formatAuditTime } from "@/components/patient-dashboard/dashboard-data";
import { getAuditLogs, getBranches, getBranchesPage, AuditLog } from "@/lib/api";

const PAGE_SIZE = 10;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ACRONYMS = new Set(["otp", "ip", "id", "nic"]);

function formatLabel(value?: string | null): string {
    if (!value) return "—";
    if (value === "UPDATE_SUPERADMIN_USER") return "Update user";
    if (value === "CREATE_SUPERADMIN_USER") return "Create user";
    
    const words = value.toLowerCase().split("_").filter(Boolean);
    if (words.length === 0) return "—";
    return words
        .map((w, i) => (ACRONYMS.has(w) ? w.toUpperCase() : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(" ");
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

function summariseDetails(details?: string, action?: string): string {
    if (!details) return "";
    const parsed = parseDetails(details);
    if (!parsed) return details;
    
    if (action === "UPDATE_SUPERADMIN_USER") {
        const parts = [];
        if (parsed.isActive && typeof parsed.isActive === "object" && 'old' in parsed.isActive) {
            const oldStatus = (parsed.isActive as any).old ? "Active" : "Inactive";
            const newStatus = (parsed.isActive as any).new ? "Active" : "Inactive";
            if (oldStatus !== newStatus) {
                parts.push(`status changed from ${oldStatus} to ${newStatus}`);
            }
        } else if (parsed.isActive !== undefined) {
            parts.push(`status set to ${parsed.isActive ? "Active" : "Inactive"}`);
        }
        
        if (parsed.role && typeof parsed.role === "object" && 'old' in parsed.role) {
            if ((parsed.role as any).old !== (parsed.role as any).new) {
                parts.push(`role changed from ${(parsed.role as any).old} to ${(parsed.role as any).new}`);
            }
        } else if (parsed.role !== undefined) {
            parts.push(`role updated to ${parsed.role}`);
        }
        
        if (parsed.email && typeof parsed.email === "object" && 'old' in parsed.email) {
            if ((parsed.email as any).old !== (parsed.email as any).new) {
                parts.push(`email changed from ${(parsed.email as any).old || 'none'} to ${(parsed.email as any).new}`);
            }
        } else if (parsed.email !== undefined) {
            parts.push(`email updated to ${parsed.email}`);
        }
        
        if (parts.length > 0) {
            return `Updating user info: ${parts.join(', ')}`;
        }
    }
    
    // Generic fallback for objects containing old/new
    const formattedEntries = Object.entries(parsed).map(([k, v]) => {
        if (v && typeof v === "object" && 'old' in v && 'new' in v) {
            if ((v as any).old !== (v as any).new) {
                return `${k} changed from ${detailValue((v as any).old)} to ${detailValue((v as any).new)}`;
            }
            return null; // Don't print if it didn't change
        }
        return `${k}: ${detailValue(v)}`;
    }).filter(Boolean);
    
    if (formattedEntries.length === 0) {
        return `Updating info: no changes made`;
    }
    
    return formattedEntries.join(" · ");
}

const LOG_STATUS_TONE: Record<string, ChipTone> = {
    SUCCESS: "success",
    WARNING: "pending",
};

function toneForLogStatus(status: string): ChipTone {
    return LOG_STATUS_TONE[status?.toUpperCase()] ?? toneForStatus(status);
}

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

function formatClock(ts: string): string | null {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function GlobalAuditTrailsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("ALL");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [page, setPage] = useState(1);
    const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    
    // For mapping branch codes to names
    const [branchMap, setBranchMap] = useState<Record<string, string>>({});
    const [branchesList, setBranchesList] = useState<{code: string, name: string}[]>([]);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                // Fetch a large number of branches to populate the dropdown
                const branchData = await getBranches();
                const map: Record<string, string> = {};
                branchData.forEach(b => {
                    map[b.code] = b.name;
                });
                setBranchMap(map);
                setBranchesList(branchData.map(b => ({ code: b.code, name: b.name })));
            } catch (err) {
                console.error("Failed to fetch branches", err);
            }
        };
        fetchBranches();
    }, []);

    useEffect(() => {
        const fetchLogs = async () => {
            setIsLoading(true);
            try {
                const params: any = {
                    page: page - 1,
                    size: PAGE_SIZE,
                    sortDir: sortDir
                };
                if (searchQuery) params.search = searchQuery;
                if (selectedBranch && selectedBranch !== "ALL") params.branchCode = selectedBranch;
                if (startDate) params.startDate = new Date(startDate);
                if (endDate) params.endDate = new Date(endDate);
                
                const data = await getAuditLogs(params);
                setLogs(data.content);
                setTotalElements(data.totalElements);
                setTotalPages(data.totalPages);
            } catch (err) {
                console.error("Failed to fetch audit logs", err);
                toast.error("Failed to load audit logs");
            } finally {
                setIsLoading(false);
            }
        };
        
        // Debounce search slightly
        const timeoutId = setTimeout(fetchLogs, 300);
        return () => clearTimeout(timeoutId);
    }, [page, searchQuery, selectedBranch, sortDir, startDate, endDate]);

    const hasFilters = Boolean(searchQuery || selectedBranch !== "ALL" || startDate || endDate);

    const clearFilters = () => {
        setSearchQuery("");
        setSelectedBranch("ALL");
        setStartDate("");
        setEndDate("");
        setPage(1);
    };

    const withPageReset = (setter: (value: string) => void) => (value: string) => {
        setter(value);
        setPage(1);
    };

    const handleExportExcel = async () => {
        try {
            // Fetch up to 1000 logs for export
            const params: any = { page: 0, size: 1000 };
            if (searchQuery) params.search = searchQuery;
            if (selectedBranch && selectedBranch !== "ALL") params.branchCode = selectedBranch;
            if (startDate) params.startDate = new Date(startDate);
            if (endDate) params.endDate = new Date(endDate);
            
            const data = await getAuditLogs(params);
            
            if (!data.content || data.content.length === 0) {
                toast.message("No logs to export based on current filters.");
                return;
            }

            const headers = ["Timestamp", "User", "Branch", "Action", "Entity Type", "Entity ID", "IP Address", "Details"];
            const rows = data.content.map((log) => [
                formatFullTimestamp(log.timestamp),
                log.performedBy || "System",
                branchMap[log.branchCode || "SYSTEM"] || log.branchCode || "SYSTEM",
                log.action,
                log.entityType,
                log.entityId || "-",
                log.ipAddress || "-",
                log.details || "-",
            ]);

            const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            const colWidths = headers.map((h, i) => ({
                wch: Math.min(Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)) + 2, 80),
            }));
            worksheet["!cols"] = colWidths;

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Global Audit Logs");
            XLSX.writeFile(workbook, `Global_Audit_Logs_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            toast.error("Failed to export logs");
        }
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

            {/* Screen-reader status for filter changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {`${totalElements} audit ${totalElements === 1 ? "entry" : "entries"} found.`}
            </p>

            {/* KPI row */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile label="Global actions" value={totalElements.toLocaleString()} icon={Globe} note="Total logs recorded" />
                <KpiTile label="Failed logins" value="412" icon={ShieldX} tone="danger" delta={{ value: 12, label: "vs previous 30 days" }} />
                <KpiTile label="Critical incidents" value="42" icon={AlertTriangle} tone="warning" note="Requires audit" />
                <KpiTile label="Active sessions" value="1,248" icon={Radio} tone="success" note="Across 12 nodes" />
            </div>

            <SectionCard title="System audit trail" count={totalElements} flush>
                {/* Filter toolbar */}
                <div className="border-b border-edge bg-surface-muted px-3 py-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12">
                        <InputField
                            label="Search"
                            type="search"
                            value={searchQuery}
                            onChange={(e) => withPageReset(setSearchQuery)(e.target.value)}
                            placeholder="User, entity id or IP address"
                            autoComplete="off"
                            className="sm:col-span-2 lg:col-span-3"
                        />
                        <SelectField label="Branch" value={selectedBranch} onChange={(e) => withPageReset(setSelectedBranch)(e.target.value)} className="lg:col-span-2">
                            <option value="ALL">All branches</option>
                            {branchesList.map(branch => (
                                <option key={branch.code} value={branch.code}>
                                    {branch.name} ({branch.code})
                                </option>
                            ))}
                        </SelectField>
                        <InputField
                            label="Start Date"
                            type="datetime-local"
                            value={startDate}
                            onChange={(e) => withPageReset(setStartDate)(e.target.value)}
                            className="lg:col-span-3"
                        />
                        <InputField
                            label="End Date"
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => withPageReset(setEndDate)(e.target.value)}
                            className="lg:col-span-3"
                        />
                        {hasFilters && (
                            <div className="flex items-end lg:col-span-1 lg:justify-end">
                                <Button variant="ghost" icon={X} onClick={clearFilters}>
                                    Clear
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-8 text-fg-muted">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : logs.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={SearchX}
                            title="No entries match"
                            description="Try a different search term or branch."
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
                                {logs.map((log) => {
                                    const relative = formatAuditTime(log.timestamp);
                                    const clock = formatClock(log.timestamp);
                                    const showClock = clock !== null && !relative.includes(":") && !relative.endsWith("ago") && relative !== "Just now";
                                    const fullTime = formatFullTimestamp(log.timestamp);
                                    const displayBranchName = branchMap[log.branchCode || "SYSTEM"] || log.branchCode || "SYSTEM";
                                    
                                    return (
                                        <tr key={log.id} className="transition-colors hover:bg-surface-hover">
                                            {/* Time */}
                                            <td className="py-2 pl-4 pr-3 tabular-nums text-fg-secondary">
                                                <span title={fullTime}>{relative}</span>
                                                {showClock && <span className="block text-xs text-fg-muted">{clock}</span>}
                                            </td>
                                            {/* User */}
                                            <td className="px-3 py-2">
                                                <span className="block truncate font-medium text-fg" title={log.performedBy || "System"}>
                                                    {log.performedBy || "System"}
                                                </span>
                                            </td>
                                            {/* Branch */}
                                            <td className="hidden px-3 py-2 md:table-cell">
                                                <StatusChip tone={log.branchCode === "SYSTEM" ? "neutral" : "info"} size="sm" title={displayBranchName}>
                                                    {displayBranchName}
                                                </StatusChip>
                                            </td>
                                            {/* Module / action */}
                                            <td className="px-3 py-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedLog(log)}
                                                    className="flex flex-col items-start rounded px-2 py-1 -ml-2 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-left"
                                                >
                                                    <span className="block w-full truncate text-fg font-medium" title={log.action}>
                                                        {formatLabel(log.action)}
                                                    </span>
                                                    <span className="block w-full truncate text-xs text-fg-muted">{formatLabel(log.entityType)}</span>
                                                </button>
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
                                            {/* IP */}
                                            <td className="hidden truncate px-3 py-2 font-mono text-xs text-fg-muted xl:table-cell" title={log.ipAddress}>
                                                {log.ipAddress || "-"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {logs.length > 0 && (
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={totalElements}
                        pageSize={PAGE_SIZE}
                        onPageChange={setPage}
                        itemLabel={totalElements === 1 ? "entry" : "entries"}
                    />
                )}
            </SectionCard>

            <Modal
                open={selectedLog !== null}
                onClose={() => setSelectedLog(null)}
                title="Audit Log Details"
                size="md"
                footer={<Button onClick={() => setSelectedLog(null)}>Close</Button>}
            >
                {selectedLog && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="block text-xs text-fg-muted font-medium mb-1">Time</span>
                                <span className="text-sm">{formatFullTimestamp(selectedLog.timestamp)}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-fg-muted font-medium mb-1">User</span>
                                <span className="text-sm">{selectedLog.performedBy || "System"}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-fg-muted font-medium mb-1">Action</span>
                                <span className="text-sm font-medium">{formatLabel(selectedLog.action)}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-fg-muted font-medium mb-1">Entity Type</span>
                                <span className="text-sm">{formatLabel(selectedLog.entityType)}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-fg-muted font-medium mb-1">Entity ID</span>
                                <span className="text-sm font-mono">{selectedLog.entityId || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-fg-muted font-medium mb-1">IP Address</span>
                                <span className="text-sm font-mono">{selectedLog.ipAddress || "-"}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="block text-xs text-fg-muted font-medium mb-1">Description</span>
                                <div className="text-sm bg-surface-muted p-2 rounded">
                                    {summariseDetails(selectedLog.details, selectedLog.action) || "-"}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <span className="block text-xs text-fg-muted font-medium mb-1">Raw Details</span>
                                <pre className="text-sm font-mono bg-surface-muted p-2 rounded whitespace-pre-wrap">
                                    {selectedLog.details ? (
                                        (() => {
                                            try {
                                                return JSON.stringify(JSON.parse(selectedLog.details), null, 2);
                                            } catch (e) {
                                                return selectedLog.details;
                                            }
                                        })()
                                    ) : "-"}
                                </pre>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <p className="mt-4 text-xs text-fg-muted">&copy; 2023 Durdans Hospital &middot; Global Admin Suite v3.1.0</p>
        </div>
    );
}
