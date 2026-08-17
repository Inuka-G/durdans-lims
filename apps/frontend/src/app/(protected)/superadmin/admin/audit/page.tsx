"use client";

import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
        timestamp: "Oct 26, 2023 16:45 PM",
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

export default function GlobalAuditTrailsPage() {
    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("All Branches");
    const [selectedRole, setSelectedRole] = useState("All Roles");
    const [selectedModule, setSelectedModule] = useState("All Modules");
    const [selectedAction, setSelectedAction] = useState("All Actions");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

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
        <div className="max-w-[1400px] mx-auto w-full font-sans text-slate-900 min-h-[calc(100vh-136px)] pt-2 pb-10 flex flex-col">

            {/* Breadcrumb & Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                    <span className="hover:text-slate-800 cursor-pointer transition-colors">System</span>
                    <span className="text-[10px] opacity-50">/</span>
                    <span className="hover:text-slate-800 cursor-pointer transition-colors">Global Administration</span>
                    <span className="text-[10px] opacity-50">/</span>
                    <span className="text-slate-800 font-bold">Audit Trails</span>
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Global Audit Trails</h1>
                <p className="text-sm font-medium text-slate-500 mt-1">
                    System-wide audit trail for security events, user actions, and administrative changes across all branches.
                </p>
            </div>

            {/* Filters Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 shadow-sm flex flex-col gap-4">
                <div className="flex flex-wrap lg:flex-nowrap gap-4 items-end">

                    {/* Date Range */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[280px]">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Date Range</label>
                        <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-1/2 bg-transparent text-slate-800 font-bold text-sm focus:outline-none cursor-pointer py-0.5"
                            />
                            <span className="text-slate-400 font-black">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-1/2 bg-transparent text-slate-800 font-bold text-sm focus:outline-none cursor-pointer py-0.5"
                            />
                        </div>
                    </div>

                    {/* Branch Filter */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Branch</label>
                        <div className="relative">
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                className="w-full appearance-none border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 border-transparent text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                            >
                                {uniqueBranches.map(branch => <option key={branch} value={branch}>{branch}</option>)}
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    {/* Role Filter */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">User Role</label>
                        <div className="relative">
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="w-full appearance-none border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 border-transparent text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                            >
                                {uniqueRoles.map(role => <option key={role} value={role}>{role}</option>)}
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    {/* Module Filter */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Module</label>
                        <div className="relative">
                            <select
                                value={selectedModule}
                                onChange={(e) => setSelectedModule(e.target.value)}
                                className="w-full appearance-none border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 border-transparent text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                            >
                                {uniqueModules.map(mod => <option key={mod} value={mod}>{mod}</option>)}
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    {/* Action Filter */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Action Type</label>
                        <div className="relative">
                            <select
                                value={selectedAction}
                                onChange={(e) => setSelectedAction(e.target.value)}
                                className="w-full appearance-none border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 border-transparent text-slate-800 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                            >
                                {uniqueActions.map(action => <option key={action} value={action}>{action}</option>)}
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap lg:flex-nowrap gap-4 items-center mt-2">
                    <div className="flex-1 relative">
                        <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Search logs by User Name, Entity ID or IP Address..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-50 border border-slate-100 text-slate-800 font-semibold py-2.5 pl-10 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full placeholder:text-slate-400 placeholder:font-medium"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm shadow-blue-500/30 active:scale-95 whitespace-nowrap">
                            Apply Filters
                        </button>
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl px-5 py-2.5 font-bold transition-colors whitespace-nowrap shadow-sm"
                        >
                            <span className="material-icons text-[18px]">table_view</span>
                            Export Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Total Actions */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-200 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Global Actions</h3>
                        <div className="bg-blue-50 text-blue-600 w-8 h-8 rounded-xl flex items-center justify-center">
                            <span className="material-icons text-[18px]">public</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-900 tracking-tight">84,204</span>
                        </div>
                        <span className="text-[12px] font-bold text-slate-400">Past 30 days</span>
                    </div>
                </div>

                {/* Failed Logins */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-red-200 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Failed Logins</h3>
                        <div className="bg-red-50 text-red-500 w-8 h-8 rounded-xl flex items-center justify-center border border-red-100">
                            <span className="material-icons text-[18px]">gpp_bad</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-black text-slate-900 tracking-tight">412</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                            <span className="material-icons text-[10px] mr-0.5">trending_up</span> 12%
                        </span>
                    </div>
                </div>

                {/* Critical Actions */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-orange-200 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Critical Incidents</h3>
                        <div className="bg-orange-50 text-orange-500 w-8 h-8 rounded-xl flex items-center justify-center">
                            <span className="material-icons text-[18px]">warning</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-black text-slate-900 tracking-tight">42</span>
                        <span className="text-[12px] font-bold text-orange-500">Requires Audit</span>
                    </div>
                </div>

                {/* Active Sessions */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-200 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Active Sessions</h3>
                        <div className="bg-emerald-50 text-emerald-500 w-8 h-8 rounded-xl flex items-center justify-center">
                            <span className="material-icons text-[18px]">sensors</span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-black text-slate-900 tracking-tight">1,248</span>
                        <span className="text-[12px] font-bold text-emerald-500">Across 12 nodes</span>
                    </div>
                </div>
            </div>

            {/* Audit Trail Table Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 pb-4">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-50 text-slate-600 rounded-lg flex items-center justify-center">
                            <span className="material-icons text-[18px]">view_timeline</span>
                        </div>
                        <h2 className="text-[15px] font-extrabold text-slate-900">System Audit Trail</h2>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-[13px] font-bold cursor-pointer hover:text-slate-600 transition-colors">
                        <span>Auto-refresh in 45s</span>
                        <span className="material-icons text-[16px]">sync</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Timestamp</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">User Details</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Branch</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Module / Action</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Entity ID</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">IP Address</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredLogs.length > 0 ? (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <span className="text-[13px] font-semibold text-slate-500 whitespace-nowrap">{log.timestamp}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-[14px] font-bold text-slate-900 leading-snug">{log.user}</span>
                                                <span className="text-[12px] font-semibold text-slate-500">{log.role}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${log.branch === 'Global' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                {log.branch}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-bold text-slate-800">{log.action}</span>
                                                <span className="text-[12px] font-medium text-slate-500">{log.module}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-[12px] font-bold text-slate-600 font-mono bg-slate-100 px-2 py-1 rounded select-all">{log.entityId}</span>
                                        </td>
                                        <td className="py-4 px-6">
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
                                        <td className="py-4 px-6">
                                            <span className="text-[12px] font-semibold text-slate-400 font-mono">{log.ipAddress}</span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-[14px] font-medium text-slate-500 bg-slate-50/50">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-icons text-4xl text-slate-300">search_off</span>
                                            <span>No system logs found matching your criteria.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Custom Footer */}
            <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs font-semibold text-slate-400 gap-4">
                <div className="flex items-center gap-2">
                    <span>&copy; 2023 Durdans Hospital. Global Admin Suite V 3.1.0</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="flex items-center gap-1.5">
                        Log Retention: <span className="text-slate-600 font-bold">180 Days</span>
                    </span>
                </div>
                <div className="flex items-center justify-end gap-6 flex-1">
                    <a href="#" className="hover:text-slate-600 transition-colors font-bold">Compliance Reports</a>
                    <button className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg transition-colors font-bold shadow-sm">
                        Export Full Dump
                    </button>
                </div>
            </div>

        </div>
    );
}
