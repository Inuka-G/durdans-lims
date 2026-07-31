"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuditLogs, getMetadata, type AuditLog } from "@/lib/api";

type BranchActor = {
    id: string;
    initials: string;
    bgColor: string;
    textColor: string;
    displayName: string;
    username: string;
    roles: string[];
    branchCode: string;
    actionCount: number;
    lastActivity: string;
    rawLastActivity: string;
    lastIpAddress: string;
    activityStatus: "RECENT" | "OLDER";
};

const PAGE_SIZE = 250;

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

const AVATAR_STYLES = [
    ["bg-blue-100", "text-blue-600"],
    ["bg-emerald-100", "text-emerald-700"],
    ["bg-violet-100", "text-violet-700"],
    ["bg-amber-100", "text-amber-700"],
    ["bg-rose-100", "text-rose-700"],
] as const;

function formatName(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return "Unknown User";
    if (trimmed.toUpperCase() === "SYSTEM") return "System";

    const localPart = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
    const normalized = localPart.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();

    return normalized
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function getInitials(name: string) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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

function isRecentActivity(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return date >= cutoff;
}

function buildActors(logs: AuditLog[]) {
    const grouped = new Map<string, AuditLog[]>();

    logs.forEach((log) => {
        const actor = log.performedBy?.trim();
        if (!actor) return;
        grouped.set(actor, [...(grouped.get(actor) || []), log]);
    });

    return Array.from(grouped.entries())
        .map(([username, actorLogs], index): BranchActor => {
            const sortedLogs = [...actorLogs].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            const latest = sortedLogs[0];
            const displayName = formatName(username);
            const [bgColor, textColor] = AVATAR_STYLES[index % AVATAR_STYLES.length];

            return {
                id: username,
                initials: getInitials(displayName),
                bgColor,
                textColor,
                displayName,
                username,
                roles: Array.from(new Set(actorLogs.map(inferRole))).sort(),
                branchCode: latest?.branchCode || "-",
                actionCount: actorLogs.length,
                lastActivity: formatTimestamp(latest?.timestamp),
                rawLastActivity: latest?.timestamp || "",
                lastIpAddress: latest?.ipAddress || "-",
                activityStatus: latest?.timestamp && isRecentActivity(latest.timestamp) ? "RECENT" : "OLDER",
            };
        })
        .sort((a, b) => new Date(b.rawLastActivity).getTime() - new Date(a.rawLastActivity).getTime());
}

export default function BranchUserManagementPage() {
    const [branchName, setBranchName] = useState("Durdans Branch");
    const [users, setUsers] = useState<BranchActor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRoleFilter, setSelectedRoleFilter] = useState("All Roles");
    const [selectedStatusFilter, setSelectedStatusFilter] = useState("All Activity");

    const loadUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const [metadata, auditData] = await Promise.all([
                getMetadata().catch(() => null),
                getAuditLogs({ page: 0, size: PAGE_SIZE }),
            ]);

            setBranchName(metadata?.currentBranchName || "Durdans Branch");
            setUsers(buildActors(auditData.content || []));
        } catch (loadError) {
            console.error("Failed to load branch users from audit logs", loadError);
            setError("Could not load branch users from audit logs.");
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    const roleOptions = useMemo(() => {
        return ["All Roles", ...Array.from(new Set(users.flatMap((user) => user.roles))).sort()];
    }, [users]);

    const filteredUsers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return users.filter((user) => {
            const matchesQuery =
                !query ||
                user.displayName.toLowerCase().includes(query) ||
                user.username.toLowerCase().includes(query) ||
                user.branchCode.toLowerCase().includes(query) ||
                user.lastIpAddress.toLowerCase().includes(query);
            const matchesRole =
                selectedRoleFilter === "All Roles" ||
                user.roles.some((role) => role === selectedRoleFilter);
            const matchesStatus =
                selectedStatusFilter === "All Activity" ||
                (selectedStatusFilter === "Recent" && user.activityStatus === "RECENT") ||
                (selectedStatusFilter === "Older" && user.activityStatus === "OLDER");

            return matchesQuery && matchesRole && matchesStatus;
        });
    }, [searchQuery, selectedRoleFilter, selectedStatusFilter, users]);

    return (
        <div className="w-full bg-[#f8fafc] min-h-[calc(100vh-76px)] p-8 font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
                        Branch Users - {branchName}
                    </h1>
                    <p className="text-[13px] font-medium text-[#64748b] mt-1">
                        Staff observed from real branch audit activity.
                    </p>
                </div>
                <button
                    onClick={loadUsers}
                    className="flex items-center justify-center gap-2 bg-[#1277E1] hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm active:scale-95"
                >
                    <span className="material-icons text-[18px]">refresh</span>
                    Refresh Users
                </button>
            </div>

            <div className="bg-white border text-sm border-[#ecf0f6] shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="relative flex-1 max-w-[600px]">
                    <span className="material-icons text-[18px] absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]">search</span>
                    <input
                        type="text"
                        placeholder="Search by actor, branch, or IP address..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="bg-[#f8fafc] border border-[#ecf0f6] text-[#0f172a] font-semibold py-2.5 pl-11 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all w-full placeholder:text-[#94a3b8] placeholder:font-medium text-[13px]"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative w-[190px]">
                        <select
                            value={selectedRoleFilter}
                            onChange={(event) => setSelectedRoleFilter(event.target.value)}
                            className="w-full appearance-none bg-white border border-[#ecf0f6] text-[#475569] font-bold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all cursor-pointer text-[13px]"
                        >
                            {roleOptions.map((role) => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                        <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none text-lg">expand_more</span>
                    </div>

                    <div className="relative w-[150px]">
                        <select
                            value={selectedStatusFilter}
                            onChange={(event) => setSelectedStatusFilter(event.target.value)}
                            className="w-full appearance-none bg-white border border-[#ecf0f6] text-[#475569] font-bold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all cursor-pointer text-[13px]"
                        >
                            <option value="All Activity">All Activity</option>
                            <option value="Recent">Recent</option>
                            <option value="Older">Older</option>
                        </select>
                        <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none text-lg">expand_more</span>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-[#ecf0f6] shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] rounded-2xl overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="border-b border-[#ecf0f6] bg-[#f8fafc]">
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[28%]">Actor</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[22%]">Observed Roles</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[12%]">Branch</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest text-center w-[12%]">Actions Logged</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[16%]">Last Activity</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[12%]">Last IP</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest text-right w-[8%]">Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f8fafc]">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-[#64748b] font-medium text-[13px]">
                                        Loading branch users...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-red-500 font-medium text-[13px]">
                                        {error}
                                    </td>
                                </tr>
                            ) : filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-[#f8fafc]/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full ${user.bgColor} ${user.textColor} flex items-center justify-center text-[10px] font-extrabold`}>
                                                    {user.initials}
                                                </div>
                                                <div>
                                                    <span className="block text-[14px] font-extrabold text-[#0f172a]">{user.displayName}</span>
                                                    <span className="block text-[11px] font-semibold text-[#94a3b8]">{user.username}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-wrap gap-1.5 items-start">
                                                {user.roles.map((role) => (
                                                    <span key={role} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#eff6ff] text-[#1277E1]">
                                                        {role}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-[13px] font-bold text-[#64748b]">{user.branchCode}</span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="text-[13px] font-extrabold text-[#0f172a]">{user.actionCount.toLocaleString()}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[13px] font-medium text-[#64748b]">{user.lastActivity}</span>
                                                <span className={`inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${
                                                    user.activityStatus === "RECENT"
                                                        ? "border-[#86efac]/30 text-[#16a34a] bg-green-50"
                                                        : "border-[#fbbf24]/30 text-[#b45309] bg-amber-50"
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${user.activityStatus === "RECENT" ? "bg-[#22c55e]" : "bg-[#f59e0b]"}`} />
                                                    {user.activityStatus}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-[12px] font-mono text-[#64748b]">{user.lastIpAddress}</span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <Link
                                                href={`/branch/activity-logs`}
                                                className="inline-flex items-center justify-center text-[#94a3b8] hover:text-[#1277E1] transition-colors p-1"
                                                title="View audit trail"
                                            >
                                                <span className="material-icons text-[18px]">history</span>
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-[#64748b] font-medium text-[13px]">
                                        No branch users found from audit activity.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-[#ecf0f6] flex items-center justify-between text-[13px]">
                    <span className="text-[#64748b] font-medium">
                        Showing {filteredUsers.length} of {users.length} audit actors
                    </span>
                    <Link
                        href="/branch/activity-logs"
                        className="text-[#1277E1] hover:text-blue-700 font-bold flex items-center gap-1"
                    >
                        Open Activity Logs
                        <span className="material-icons text-[16px]">open_in_new</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
