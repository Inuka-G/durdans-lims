"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getAuditLogs, getMetadata, type AuditLog } from "@/lib/api";

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

const PAGE_SIZE = 200;

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

function escapeCsv(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
}

export default function ActivityLogsPage() {
    const [branchName, setBranchName] = useState("Durdans Branch");
    const [logs, setLogs] = useState<ActivityLogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRole, setSelectedRole] = useState("All Roles");
    const [selectedModule, setSelectedModule] = useState("All Modules");
    const [selectedAction, setSelectedAction] = useState("All Actions");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const loadLogs = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const [metadata, auditData] = await Promise.all([
                getMetadata().catch(() => null),
                getAuditLogs({ page: 0, size: PAGE_SIZE }),
            ]);

            setBranchName(metadata?.currentBranchName || "Durdans Branch");
            setLogs((auditData.content || []).map(toRow));
        } catch (loadError) {
            console.error("Failed to load branch activity logs", loadError);
            setError("Could not load branch activity logs.");
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadLogs();
        const refresh = window.setInterval(loadLogs, 30000);

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
            const matchesRole = selectedRole === "All Roles" || log.role === selectedRole;
            const matchesModule = selectedModule === "All Modules" || log.module === selectedModule;
            const matchesAction = selectedAction === "All Actions" || log.action === selectedAction;

            return (
                matchesSearch &&
                matchesRole &&
                matchesModule &&
                matchesAction &&
                isWithinDateRange(log, startDate, endDate)
            );
        });
    }, [endDate, logs, searchQuery, selectedAction, selectedModule, selectedRole, startDate]);

    const uniqueRoles = useMemo(() => ["All Roles", ...Array.from(new Set(logs.map((log) => log.role)))], [logs]);
    const uniqueModules = useMemo(() => ["All Modules", ...Array.from(new Set(logs.map((log) => log.module)))], [logs]);
    const uniqueActions = useMemo(() => ["All Actions", ...Array.from(new Set(logs.map((log) => log.action)))], [logs]);

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

    const handleExportCSV = () => {
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

        const csvContent = [headers, ...rows]
            .map((row) => row.map((value) => escapeCsv(String(value))).join(","))
            .join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Activity_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full font-sans text-slate-900 bg-[#f8fafc] min-h-screen flex flex-col">
            <div className="text-xs text-slate-500 mb-4 flex items-center gap-2">
                <span>Home</span>
                <span>/</span>
                <span>Audit</span>
                <span>/</span>
                <span className="font-semibold text-slate-800">Activity Logs</span>
            </div>

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">
                    Activity Logs - {branchName}
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Real audit trail for branch workflow, user actions, and security events.
                </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm flex flex-col gap-4">
                <div className="flex flex-wrap md:flex-nowrap gap-4 items-end">
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[280px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date Range</label>
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-1 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(event) => setStartDate(event.target.value)}
                                className="w-1/2 bg-transparent text-slate-700 font-medium text-sm focus:outline-none cursor-pointer py-1"
                            />
                            <span className="text-slate-400 font-bold">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(event) => setEndDate(event.target.value)}
                                className="w-1/2 bg-transparent text-slate-700 font-medium text-sm focus:outline-none cursor-pointer py-1"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">User Role</label>
                        <div className="relative">
                            <select
                                value={selectedRole}
                                onChange={(event) => setSelectedRole(event.target.value)}
                                className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {uniqueRoles.map((role) => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Module</label>
                        <div className="relative">
                            <select
                                value={selectedModule}
                                onChange={(event) => setSelectedModule(event.target.value)}
                                className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {uniqueModules.map((module) => (
                                    <option key={module} value={module}>{module}</option>
                                ))}
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action Type</label>
                        <div className="relative">
                            <select
                                value={selectedAction}
                                onChange={(event) => setSelectedAction(event.target.value)}
                                className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {uniqueActions.map((action) => (
                                    <option key={action} value={action}>{action}</option>
                                ))}
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={loadLogs}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm shadow-blue-600/20 whitespace-nowrap"
                        >
                            Refresh
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center justify-center border border-slate-200 rounded-lg w-10 h-10 hover:bg-slate-50 transition-colors text-slate-500"
                            title="Download CSV"
                        >
                            <span className="material-icons text-[20px]">download</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-4 items-center">
                    <div className="flex-1 relative">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                        <input
                            type="text"
                            placeholder="Search by user, entity ID, action, or IP address..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400"
                        />
                    </div>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg px-4 py-2.5 font-bold text-sm transition-colors whitespace-nowrap"
                    >
                        <span className="material-icons text-[18px]">sim_card_download</span>
                        Export Logs (CSV)
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Actions</h3>
                        <div className="bg-blue-50 text-blue-500 w-7 h-7 rounded-md flex items-center justify-center">
                            <span className="material-icons text-[16px]">bolt</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-0.5 mt-2">
                        <span className="text-3xl font-extrabold text-slate-900">{totalActionsLastSevenDays.toLocaleString()}</span>
                        <span className="text-[11px] font-semibold text-slate-400">Last 7 days from audit logs</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Failed Logins</h3>
                        <div className="bg-red-50 text-red-500 w-7 h-7 rounded-md flex items-center justify-center border border-red-100">
                            <span className="material-icons text-[16px]">login</span>
                        </div>
                    </div>
                    <span className="text-3xl font-extrabold text-slate-900 mt-2">{failedLogins.toLocaleString()}</span>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Critical Actions</h3>
                        <div className="bg-orange-50 text-orange-500 w-7 h-7 rounded-md flex items-center justify-center">
                            <span className="material-icons text-[16px]">priority_high</span>
                        </div>
                    </div>
                    <span className="text-3xl font-extrabold text-slate-900 mt-2">{criticalActions.toLocaleString()}</span>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Users</h3>
                        <div className="bg-emerald-50 text-emerald-500 w-7 h-7 rounded-md flex items-center justify-center">
                            <span className="material-icons text-[16px]">people</span>
                        </div>
                    </div>
                    <span className="text-3xl font-extrabold text-slate-900 mt-2">{activeUsers.toLocaleString()}</span>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 pb-4">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-icons text-slate-400 text-[18px]">list_alt</span>
                        <h2 className="text-[15px] font-extrabold text-slate-800">Audit Trail</h2>
                    </div>
                    <button
                        onClick={loadLogs}
                        className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold hover:text-slate-600 transition-colors"
                    >
                        <span>{loading ? "Refreshing..." : "Refresh now"}</span>
                        <span className="material-icons text-[14px]">refresh</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white border-b border-slate-100">
                            <tr>
                                <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Timestamp</th>
                                <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">User</th>
                                <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Role</th>
                                <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Module</th>
                                <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Action</th>
                                <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Entity ID</th>
                                <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">IP Address</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                                        Loading branch activity...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-red-500">
                                        {error}
                                    </td>
                                </tr>
                            ) : filteredLogs.length > 0 ? (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-3 text-xs text-slate-500 font-medium whitespace-nowrap">
                                            {log.timestamp}
                                        </td>
                                        <td className="px-5 py-3 text-xs font-semibold text-slate-800 whitespace-nowrap">
                                            {log.user}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                                            {log.role}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                                            {log.module}
                                        </td>
                                        <td className="px-5 py-3 text-xs font-medium text-slate-800 whitespace-nowrap">
                                            {log.action}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                                            {log.entityId}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            {log.status === "SUCCESS" && (
                                                <span className="inline-flex items-center gap-1.5 text-emerald-600 text-[11px] font-bold tracking-wide">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> SUCCESS
                                                </span>
                                            )}
                                            {log.status === "FAILED" && (
                                                <span className="inline-flex items-center gap-1.5 text-red-500 text-[11px] font-bold tracking-wide">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> FAILED
                                                </span>
                                            )}
                                            {log.status === "WARNING" && (
                                                <span className="inline-flex items-center gap-1.5 text-orange-500 text-[11px] font-bold tracking-wide">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> WARNING
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                                            {log.ipAddress}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-500">
                                        No logs found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
