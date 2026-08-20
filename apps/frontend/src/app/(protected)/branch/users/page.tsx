"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, History, RefreshCw, Search, Users, X } from "lucide-react";
import { getAuditLogs, getMetadata, type AuditLog } from "@/lib/api";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { InputField, SelectField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip from "@/components/ui/StatusChip";
import { formatAuditTime } from "@/components/patient-dashboard/dashboard-data";

type BranchActor = {
    id: string;
    initials: string;
    displayName: string;
    username: string;
    roles: string[];
    branchCode: string;
    actionCount: number;
    rawLastActivity: string;
    lastIpAddress: string;
    activityStatus: "RECENT" | "OLDER";
};

const PAGE_SIZE = 250;
const SKELETON_ROWS = 6;

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

/** Full, unambiguous timestamp for tooltips. */
function formatFullTimestamp(value?: string) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
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
        .map(([username, actorLogs]): BranchActor => {
            const sortedLogs = [...actorLogs].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            const latest = sortedLogs[0];
            const displayName = formatName(username);

            return {
                id: username,
                initials: getInitials(displayName),
                displayName,
                username,
                roles: Array.from(new Set(actorLogs.map(inferRole))).sort(),
                branchCode: latest?.branchCode || "-",
                actionCount: actorLogs.length,
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

    const hasFilters = Boolean(searchQuery || selectedRoleFilter !== "All Roles" || selectedStatusFilter !== "All Activity");

    const clearFilters = () => {
        setSearchQuery("");
        setSelectedRoleFilter("All Roles");
        setSelectedStatusFilter("All Activity");
    };

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Branch users"
                crumbs={[{ label: "Branch", href: "/branch" }, { label: "Users" }]}
                meta={
                    <>
                        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{branchName}</span>
                        <span aria-hidden="true">·</span>
                        <span>Staff observed from branch audit activity</span>
                        {!loading && !error && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {users.length.toLocaleString()} {users.length === 1 ? "actor" : "actors"}
                                </span>
                            </>
                        )}
                    </>
                }
                actions={
                    <Button variant="primary" icon={RefreshCw} onClick={loadUsers} loading={loading && users.length > 0}>
                        Refresh users
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? "Loading branch users"
                    : error
                      ? "Branch users failed to load"
                      : `Branch users loaded. Showing ${filteredUsers.length} of ${users.length} audit actors.`}
            </p>

            <SectionCard
                title="Audit actors"
                count={!loading && !error ? filteredUsers.length : undefined}
                flush
                actions={
                    <Button href="/branch/activity-logs" variant="ghost" size="sm" icon={History}>
                        Open activity logs
                    </Button>
                }
            >
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <InputField
                        label="Search branch users"
                        hideLabel
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search by actor, branch or IP address"
                        autoComplete="off"
                        className="min-w-[200px] flex-1"
                    />
                    <SelectField
                        label="Role"
                        hideLabel
                        value={selectedRoleFilter}
                        onChange={(event) => setSelectedRoleFilter(event.target.value)}
                        className="w-full sm:w-48"
                    >
                        {roleOptions.map((role) => (
                            <option key={role} value={role}>
                                {role === "All Roles" ? "All roles" : role}
                            </option>
                        ))}
                    </SelectField>
                    <SelectField
                        label="Activity"
                        hideLabel
                        value={selectedStatusFilter}
                        onChange={(event) => setSelectedStatusFilter(event.target.value)}
                        className="w-full sm:w-40"
                    >
                        <option value="All Activity">All activity</option>
                        <option value="Recent">Recent (30 days)</option>
                        <option value="Older">Older</option>
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
                                <span className="h-8 w-8 shrink-0 rounded-full bg-skeleton" />
                                <span className="flex flex-col gap-1.5">
                                    <span className="h-3.5 w-32 rounded bg-skeleton" />
                                    <span className="h-3 w-24 rounded bg-skeleton" />
                                </span>
                                <span className="hidden h-4 w-24 rounded bg-skeleton md:block" />
                                <span className="hidden h-3 w-16 rounded bg-skeleton md:block" />
                                <span className="ml-auto h-3 w-10 rounded bg-skeleton" />
                                <span className="hidden h-3 w-28 rounded bg-skeleton lg:block" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton xl:block" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Branch users unavailable"
                        description={`${error} Retry to load them again.`}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={loadUsers}>
                                Retry
                            </Button>
                        }
                    />
                ) : filteredUsers.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={Search}
                            title="No users match"
                            description="Try a different search term, role or activity filter."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Users}
                            title="No branch users yet"
                            description="Staff appear here once their actions are recorded in the branch audit log."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        {/* table-fixed budget — fixed cols + a >=160px floor for the auto "Observed roles" col:
                            base 224+112+176+48 = 560 (+200 auto);
                            md   +96  = 656 -> min-w 820 (+164 auto);
                            lg   +128 = 784 -> min-w 950 (+166 auto). */}
                        <table className="w-full min-w-[760px] table-fixed text-left text-[13px] md:min-w-[820px] lg:min-w-[950px]">
                            <caption className="sr-only">Branch users observed from audit activity</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                    <th scope="col" className="w-56 py-2 pl-4 pr-3 font-medium">
                                        Actor
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-medium">
                                        Observed roles
                                    </th>
                                    <th scope="col" className="hidden w-24 px-3 py-2 font-medium md:table-cell">
                                        Branch
                                    </th>
                                    <th scope="col" className="w-28 px-3 py-2 text-right font-medium">
                                        Actions logged
                                    </th>
                                    <th scope="col" className="w-44 px-3 py-2 font-medium">
                                        Last activity
                                    </th>
                                    <th scope="col" className="hidden w-32 px-3 py-2 font-medium lg:table-cell">
                                        Last IP
                                    </th>
                                    <th scope="col" className="w-12 py-2 pl-2 pr-3">
                                        <span className="sr-only">Audit</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {filteredUsers.map((user) => {
                                    const fullTime = formatFullTimestamp(user.rawLastActivity);
                                    return (
                                        <tr key={user.id} className="transition-colors hover:bg-surface-hover">
                                            {/* Actor */}
                                            <td className="py-2 pl-4 pr-3">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <span
                                                        aria-hidden="true"
                                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-fg-secondary ring-1 ring-inset ring-edge"
                                                    >
                                                        {user.initials}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <span className="block truncate font-medium text-fg" title={user.displayName}>
                                                            {user.displayName}
                                                        </span>
                                                        <span className="block truncate text-xs text-fg-muted" title={user.username}>
                                                            {user.username}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Observed roles */}
                                            <td className="whitespace-normal px-3 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {user.roles.map((role) => (
                                                        <StatusChip key={role} tone="neutral" size="sm" title={role}>
                                                            {role}
                                                        </StatusChip>
                                                    ))}
                                                </div>
                                            </td>
                                            {/* Branch */}
                                            <td className="hidden truncate px-3 py-2 text-fg-secondary md:table-cell" title={user.branchCode}>
                                                {user.branchCode}
                                            </td>
                                            {/* Actions logged */}
                                            <td className="px-3 py-2 text-right font-medium tabular-nums text-fg">
                                                {user.actionCount.toLocaleString()}
                                            </td>
                                            {/* Last activity */}
                                            <td className="px-3 py-2">
                                                <div className="flex flex-col items-start gap-1">
                                                    <time dateTime={user.rawLastActivity || undefined} title={fullTime} className="tabular-nums text-fg-secondary">
                                                        {user.rawLastActivity ? formatAuditTime(user.rawLastActivity) : "—"}
                                                    </time>
                                                    <StatusChip
                                                        tone={user.activityStatus === "RECENT" ? "success" : "neutral"}
                                                        size="sm"
                                                        dot
                                                        title={user.activityStatus === "RECENT" ? "Active in the last 30 days" : "No activity in the last 30 days"}
                                                    >
                                                        {user.activityStatus === "RECENT" ? "Recent" : "Older"}
                                                    </StatusChip>
                                                </div>
                                            </td>
                                            {/* Last IP */}
                                            <td className="hidden truncate px-3 py-2 font-mono text-xs text-fg-muted lg:table-cell" title={user.lastIpAddress}>
                                                {user.lastIpAddress}
                                            </td>
                                            {/* Audit */}
                                            <td className="py-2 pl-2 pr-3 text-right">
                                                <Button
                                                    href="/branch/activity-logs"
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={History}
                                                    aria-label={`View audit trail for ${user.displayName}`}
                                                    className="w-7 px-0 text-fg-faint hover:text-fg-secondary"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer: result count */}
                {!loading && !error && filteredUsers.length > 0 && (
                    <div className="border-t border-edge px-4 py-2 text-xs text-fg-muted">
                        Showing {filteredUsers.length} of {users.length} audit actors
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
