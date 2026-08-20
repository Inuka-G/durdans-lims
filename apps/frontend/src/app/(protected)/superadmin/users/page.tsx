"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    LayoutGrid,
    Pencil,
    RefreshCw,
    Search,
    UserCheck,
    UserPlus,
    UserX,
    Users,
    X,
} from "lucide-react";
import UserCreateModal from "@/components/admin/UserCreateModal";
import UserEditModal from "@/components/admin/UserEditModal";
import { getAdminUsers, setAdminUserEnabled, AdminUser } from "@/lib/api";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import SegmentedControl from "@/components/ui/SegmentedControl";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip, { humanizeStatus, toneForStatus } from "@/components/ui/StatusChip";

type UserStatus = "ACTIVE" | "INACTIVE";
type Tab = "directory" | "matrix";

interface UserRecord {
    id: string;
    name: string;
    email: string;
    branch: string;
    roles: string[];
    status: UserStatus;
    lastLogin: string;
}

const SKELETON_ROWS = 6;

const TAB_OPTIONS: { value: Tab; label: string }[] = [
    { value: "directory", label: "User directory" },
    { value: "matrix", label: "Global role matrix" },
];

function toRecord(u: AdminUser): UserRecord {
    return {
        id: u.id,
        name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username,
        email: u.email ?? "—",
        branch: u.branchCode ?? "—",
        roles: [],
        status: u.enabled ? "ACTIVE" : "INACTIVE",
        lastLogin: "—",
    };
}

export default function GlobalUserControlPage() {
    const [activeTab, setActiveTab] = useState<Tab>("directory");
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getAdminUsers();
            setUsers(data.map(toRecord));
        } catch {
            setError("User administration is unavailable. Enable the Keycloak admin module on the backend (app.keycloak-admin.enabled).");
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleToggleStatus = async (userId: string) => {
        const user = users.find((u) => u.id === userId);
        if (!user) return;
        try {
            await setAdminUserEnabled(userId, user.status !== "ACTIVE");
            await load();
        } catch {
            setError("Failed to update user status.");
        }
    };

    const handleEditClick = (user: UserRecord) => {
        setSelectedUser(user);
        setIsEditModalOpen(true);
    };

    // Client-side filter over the loaded directory (name, id or email).
    const visibleUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return users;
        return users.filter(
            (u) => u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        );
    }, [users, search]);

    const showErrorState = !!error && users.length === 0;
    const showErrorBanner = !!error && users.length > 0;

    return (
        <div className="mx-auto w-full max-w-[1400px]">
            <PageHeader
                title="Global user and role control"
                crumbs={[{ label: "System" }, { label: "Global administration" }, { label: "User and role control" }]}
                meta={<span>Centralised identity and access management for all hospital branches</span>}
                actions={
                    <>
                        <Button icon={RefreshCw} onClick={load} loading={loading && users.length > 0}>
                            Refresh
                        </Button>
                        <Button variant="primary" icon={UserPlus} onClick={() => setIsCreateModalOpen(true)}>
                            Create user
                        </Button>
                    </>
                }
            />

            {/* Screen-reader status for async changes. The error is announced here only when the
                visible role="alert" banner is not already announcing it, and counts only apply to
                the directory tab. */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? "Loading users"
                    : error
                      ? showErrorBanner
                          ? ""
                          : error
                      : activeTab === "directory"
                        ? `${visibleUsers.length} of ${users.length} ${users.length === 1 ? "user" : "users"} shown.`
                        : ""}
            </p>

            <div className="mb-4">
                <SegmentedControl value={activeTab} onChange={setActiveTab} options={TAB_OPTIONS} ariaLabel="User control view" />
            </div>

            {activeTab === "directory" && (
                <SectionCard title="Users" count={loading ? undefined : users.length} flush>
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                        <label className="relative block min-w-[200px] flex-1 sm:max-w-md">
                            <span className="sr-only">Search users by name, ID or email</span>
                            <Search
                                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint"
                                aria-hidden="true"
                            />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name, ID or email"
                                autoComplete="off"
                                className="h-9 w-full rounded-md border border-edge bg-surface pl-8 pr-8 text-sm text-fg placeholder:text-fg-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    aria-label="Clear search"
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-muted hover:bg-surface-hover hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                            )}
                        </label>
                    </div>

                    {showErrorBanner && (
                        <div
                            role="alert"
                            className="mx-3 mt-3 flex items-start gap-2 rounded-md bg-status-danger-bg px-3 py-2 text-xs text-status-danger-fg ring-1 ring-inset ring-status-danger-edge"
                        >
                            <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* States live outside the table so they centre on small screens */}
                    {loading ? (
                        <ul aria-hidden="true" className="divide-y divide-edge">
                            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                    <span className="h-3 w-16 shrink-0 rounded bg-skeleton" />
                                    <span className="h-4 w-36 shrink-0 rounded bg-skeleton" />
                                    <span className="hidden h-3 w-16 rounded bg-skeleton md:block" />
                                    <span className="hidden h-3 w-24 rounded bg-skeleton lg:block" />
                                    <span className="h-4 w-14 rounded bg-skeleton" />
                                    <span className="ml-auto h-3 w-16 rounded bg-skeleton" />
                                </li>
                            ))}
                        </ul>
                    ) : showErrorState ? (
                        <EmptyState
                            icon={AlertTriangle}
                            title="User administration unavailable"
                            description={error ?? undefined}
                            action={
                                <Button size="sm" icon={RefreshCw} onClick={load}>
                                    Retry
                                </Button>
                            }
                        />
                    ) : users.length === 0 ? (
                        <EmptyState
                            icon={Users}
                            title="No users yet"
                            description="Create the first user to give staff access to the system."
                            action={
                                <Button size="sm" icon={UserPlus} onClick={() => setIsCreateModalOpen(true)}>
                                    Create user
                                </Button>
                            }
                        />
                    ) : visibleUsers.length === 0 ? (
                        <EmptyState
                            icon={Search}
                            title="No users match"
                            description="Try a different name, ID or email."
                            action={
                                <Button size="sm" icon={X} onClick={() => setSearch("")}>
                                    Clear search
                                </Button>
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            {/* min-w must cover the fixed columns plus a >=160px floor for the auto
                                Name column at every band. lg reveals Roles (w-48) + Last login (w-32),
                                pushing the fixed sum to 752px, so the table needs >=912px there. */}
                            <table className="w-full min-w-[760px] table-fixed text-left text-[13px] lg:min-w-[920px]">
                                <caption className="sr-only">User directory</caption>
                                <thead>
                                    <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                        <th scope="col" className="w-28 py-2 pl-4 pr-3 font-medium">
                                            User ID
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-medium">
                                            Name
                                        </th>
                                        <th scope="col" className="hidden w-28 px-3 py-2 font-medium md:table-cell">
                                            Branch
                                        </th>
                                        <th scope="col" className="hidden w-48 px-3 py-2 font-medium lg:table-cell">
                                            Roles
                                        </th>
                                        <th scope="col" className="w-24 px-3 py-2 font-medium">
                                            Status
                                        </th>
                                        <th scope="col" className="hidden w-32 px-3 py-2 font-medium lg:table-cell">
                                            Last login
                                        </th>
                                        <th scope="col" className="w-28 py-2 pl-3 pr-4 text-right font-medium">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {visibleUsers.map((user) => {
                                        const active = user.status === "ACTIVE";
                                        return (
                                            <tr key={user.id} className="transition-colors hover:bg-surface-hover">
                                                <td className="py-2 pl-4 pr-3 font-mono text-xs text-fg-secondary" title={user.id}>
                                                    {user.id.slice(0, 8)}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex min-w-0 flex-col">
                                                        <span className="truncate font-medium text-fg" title={user.name}>
                                                            {user.name}
                                                        </span>
                                                        <span className="truncate text-xs text-fg-muted" title={user.email}>
                                                            {user.email}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="hidden truncate px-3 py-2 text-fg-secondary md:table-cell">{user.branch}</td>
                                                <td className="hidden px-3 py-2 lg:table-cell">
                                                    {user.roles.length === 0 ? (
                                                        <span className="text-fg-faint">—</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {user.roles.map((role) => (
                                                                <StatusChip key={role} size="sm">
                                                                    {role}
                                                                </StatusChip>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <StatusChip tone={toneForStatus(user.status)} dot>
                                                        {humanizeStatus(user.status)}
                                                    </StatusChip>
                                                </td>
                                                <td className="hidden truncate px-3 py-2 text-fg-muted lg:table-cell">{user.lastLogin}</td>
                                                <td className="py-2 pl-3 pr-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            icon={Pencil}
                                                            onClick={() => handleEditClick(user)}
                                                            aria-label={`Edit ${user.name}`}
                                                            title="Edit user"
                                                            className="w-7 px-0"
                                                        />
                                                        {active ? (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                icon={UserX}
                                                                onClick={() => handleToggleStatus(user.id)}
                                                                aria-label={`Deactivate ${user.name}`}
                                                                title="Deactivate user"
                                                                className="w-7 px-0 hover:text-status-danger-fg"
                                                            />
                                                        ) : (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                icon={UserCheck}
                                                                onClick={() => handleToggleStatus(user.id)}
                                                                aria-label={`Activate ${user.name}`}
                                                                title="Activate user"
                                                                className="w-7 px-0 text-status-verified-fg hover:text-status-verified-fg"
                                                            />
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            )}

            {activeTab === "matrix" && (
                <SectionCard title="Global role matrix">
                    <EmptyState
                        icon={LayoutGrid}
                        title="Role matrix is managed per role"
                        description="The master matrix is configured from the role definitions page."
                        action={
                            <Button size="sm" href="/superadmin/roles">
                                Open role definitions
                            </Button>
                        }
                    />
                </SectionCard>
            )}

            <UserCreateModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    load();
                }}
            />

            <UserEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} userData={selectedUser} />
        </div>
    );
}
