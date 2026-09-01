"use client";

import { useEffect, useState } from "react";
import { getBranchActivityLogs, BranchActivityLog, getBranches } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

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

interface FrontendLog {
    id: string;
    timestamp: string;
    user: string;
    role: string;
    module: string;
    action: string;
    entityId: string;
    status: string;
    ipAddress: string;
    details?: string;
}

export default function ActivityLogsPage() {
    const { branchCode } = useAuth();
    const [branchName, setBranchName] = useState("Loading...");
    const [logs, setLogs] = useState<FrontendLog[]>([]);
    const [selectedLog, setSelectedLog] = useState<FrontendLog | null>(null);

    useEffect(() => {
        const targetCode = branchCode || "b6030d28-10ef-4165-9554-8887fabfddb8";
        getBranches(0, 100).then((data) => {
            const branch = data.content.find((b) => b.id === targetCode || b.code.toUpperCase() === targetCode.toUpperCase());
            if (branch) {
                setBranchName(branch.name);
            } else {
                setBranchName(targetCode);
            }
        }).catch(err => {
            console.error("Failed to fetch branch details", err);
            setBranchName(targetCode);
        });
    }, [branchCode]);

    useEffect(() => {
        getBranchActivityLogs().then((data) => {
            const mapped: FrontendLog[] = data.map((log: BranchActivityLog) => {
                const dateObj = new Date(log.timestamp);
                const formattedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
                const formattedTime = dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

                return {
                    id: `LOG-${log.id}`,
                    timestamp: `${formattedDate} ${formattedTime}`,
                    user: log.performedBy || "System",
                    role: "System",
                    module: log.entityType || "-",
                    action: log.action || "-",
                    entityId: log.entityId?.toString() || log.patientCode || "-",
                    status: "SUCCESS",
                    ipAddress: log.ipAddress || "-",
                    details: log.details,
                };
            });
            setLogs(mapped);
        }).catch(err => console.error("Failed to fetch logs", err));
    }, []);

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRole, setSelectedRole] = useState("All Roles");
    const [selectedModule, setSelectedModule] = useState("All Modules");
    const [selectedAction, setSelectedAction] = useState("All Actions");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Filter logic
    const filteredLogs = logs.filter(log => {
        // Search Filter (User, Entity ID, IP)
        const query = searchQuery.toLowerCase();
        const matchesSearch = log.user.toLowerCase().includes(query) ||
            log.entityId.toLowerCase().includes(query) ||
            log.ipAddress.toLowerCase().includes(query);

        // Dropdown Filters
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

        return matchesSearch && matchesRole && matchesModule && matchesAction && matchesDate;
    });

    const uniqueRoles = ["All Roles", ...Array.from(new Set(logs.map(log => log.role)))];
    const uniqueModules = ["All Modules", ...Array.from(new Set(logs.map(log => log.module)))];
    const uniqueActions = ["All Actions", ...Array.from(new Set(logs.map(log => log.action)))];

    const handleExportCSV = () => {
        if (filteredLogs.length === 0) {
            alert("No logs to export based on current filters.");
            return;
        }

        const headers = ["Timestamp", "User", "Role", "Module", "Action", "Entity ID", "Status", "IP Address"];
        const rows = filteredLogs.map(log => [
            log.timestamp.replace(/,/g, ''),
            log.user,
            log.role,
            log.module,
            log.action,
            log.entityId,
            log.status,
            log.ipAddress
        ]);

        const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Activity_Logs_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full font-sans text-slate-900 bg-[#f8fafc] min-h-screen flex flex-col">

            {/* Breadcrumb */}
            <div className="text-xs text-slate-500 mb-4 flex items-center gap-2">
                <span className="cursor-pointer hover:text-slate-800 transition-colors">Home</span>
                <span>/</span>
                <span className="cursor-pointer hover:text-slate-800 transition-colors">Audit</span>
                <span>/</span>
                <span className="font-semibold text-slate-800">Activity Logs</span>
            </div>

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">
                    Activity Logs – {branchName}
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Audit trail for system events, user actions, and security incidents.
                </p>
            </div>

            {/* Filters Section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm flex flex-col gap-4">
                <div className="flex flex-wrap md:flex-nowrap gap-4 items-end">
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[280px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date Range</label>
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-1 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-1/2 bg-transparent text-slate-700 font-medium text-sm focus:outline-none cursor-pointer py-1"
                            />
                            <span className="text-slate-400 font-bold">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-1/2 bg-transparent text-slate-700 font-medium text-sm focus:outline-none cursor-pointer py-1"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">User Role</label>
                        <div className="relative">
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {uniqueRoles.map(role => <option key={role} value={role}>{role}</option>)}
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Module</label>
                        <div className="relative">
                            <select
                                value={selectedModule}
                                onChange={(e) => setSelectedModule(e.target.value)}
                                className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {uniqueModules.map(mod => <option key={mod} value={mod}>{mod}</option>)}
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action Type</label>
                        <div className="relative">
                            <select
                                value={selectedAction}
                                onChange={(e) => setSelectedAction(e.target.value)}
                                className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                {uniqueActions.map(action => <option key={action} value={action}>{action}</option>)}
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm shadow-blue-600/20 whitespace-nowrap">
                            Apply Filters
                        </button>
                        <button className="flex items-center justify-center border border-slate-200 rounded-lg w-10 h-10 hover:bg-slate-50 transition-colors text-slate-500">
                            <span className="material-icons text-[20px]">download</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-4 items-center">
                    <div className="flex-1 relative">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                        <input
                            type="text"
                            placeholder="Search by User Name, Entity ID or IP Address..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400"
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

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Total Actions */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Actions</h3>
                        <div className="bg-blue-50 text-blue-500 w-7 h-7 rounded-md flex items-center justify-center">
                            <span className="material-icons text-[16px]">bolt</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-0.5 mt-2">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-slate-900">14,802</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">Last 7 days</span>
                    </div>
                </div>

                {/* Failed Logins */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Failed Logins</h3>
                        <div className="bg-red-50 text-red-500 w-7 h-7 rounded-md flex items-center justify-center border border-red-100">
                            <span className="material-icons text-[16px]">login</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-3xl font-extrabold text-slate-900">124</span>
                        <span className="text-[11px] font-bold text-red-500">+5%</span>
                    </div>
                </div>

                {/* Critical Actions */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Critical Actions</h3>
                        <div className="bg-orange-50 text-orange-500 w-7 h-7 rounded-md flex items-center justify-center">
                            <span className="material-icons text-[16px]">priority_high</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-3xl font-extrabold text-slate-900">18</span>
                        <span className="text-[11px] font-bold text-orange-500">Requires Audit</span>
                    </div>
                </div>

                {/* Active Users */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Users</h3>
                        <div className="bg-emerald-50 text-emerald-500 w-7 h-7 rounded-md flex items-center justify-center">
                            <span className="material-icons text-[16px]">people</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-3xl font-extrabold text-slate-900">86</span>
                        <span className="text-[11px] font-bold text-emerald-500">Currently Online</span>
                    </div>
                </div>
            </div>

            {/* Audit Trail Table Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 pb-4">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-icons text-slate-400 text-[18px]">list_alt</span>
                        <h2 className="text-[15px] font-extrabold text-slate-800">Audit Trail</h2>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold cursor-pointer hover:text-slate-600 transition-colors">
                        <span>Auto-refresh in 45s</span>
                        <span className="material-icons text-[14px]">refresh</span>
                    </div>
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
                            {filteredLogs.length > 0 ? (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setSelectedLog(log)}>
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
                                            {log.status === 'SUCCESS' && (
                                                <span className="inline-flex items-center gap-1.5 text-emerald-600 text-[11px] font-bold tracking-wide">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> SUCCESS
                                                </span>
                                            )}
                                            {log.status === 'FAILED' && (
                                                <span className="inline-flex items-center gap-1.5 text-red-500 text-[11px] font-bold tracking-wide">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> FAILED
                                                </span>
                                            )}
                                            {log.status === 'WARNING' && (
                                                <span className="inline-flex items-center gap-1.5 text-orange-500 text-[11px] font-bold tracking-wide">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div> WARNING
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

            {/* Footer */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-6 px-2">
                <div className="flex items-center flex-wrap gap-2 text-xs font-medium text-slate-400">
                    <span>&copy; 2023 Durdans Hospital. Version 2.4.1</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="flex items-center gap-1.5">
                        System Status: <span className="text-emerald-500 font-bold">Audit Pipeline Online</span>
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors bg-white">
                        Report Issue
                    </button>
                    <button className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm shadow-slate-800/20">
                        System Audit Trail
                    </button>
                </div>
            </div>

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
                                <span className="block text-xs text-slate-500 font-medium mb-1">Time</span>
                                <span className="text-sm font-semibold">{selectedLog.timestamp}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-slate-500 font-medium mb-1">User</span>
                                <span className="text-sm font-semibold">{selectedLog.user}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-slate-500 font-medium mb-1">Action</span>
                                <span className="text-sm font-medium">{selectedLog.action}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-slate-500 font-medium mb-1">Entity Type</span>
                                <span className="text-sm">{selectedLog.module}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-slate-500 font-medium mb-1">Entity ID</span>
                                <span className="text-sm font-mono">{selectedLog.entityId || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-slate-500 font-medium mb-1">IP Address</span>
                                <span className="text-sm font-mono">{selectedLog.ipAddress || "-"}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="block text-xs text-slate-500 font-medium mb-1">Description</span>
                                <div className="text-sm bg-slate-50 p-2 rounded">
                                    {summariseDetails(selectedLog.details, selectedLog.action) || "-"}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <span className="block text-xs text-slate-500 font-medium mb-1">Raw Details</span>
                                <pre className="text-sm font-mono bg-slate-50 p-2 rounded whitespace-pre-wrap">
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
        </div>
    );
}
