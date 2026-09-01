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
import { ASSIGNABLE_ROLES, getAdminUsers, setAdminUserEnabled, AdminUser } from "@/lib/api";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import SegmentedControl from "@/components/ui/SegmentedControl";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip, { humanizeStatus, toneForStatus } from "@/components/ui/StatusChip";

// Types for Mock Data
type UserStatus = "ACTIVE" | "INACTIVE";

interface UserRecord {
    id: string;
    username: string;
    name: string;
    email: string;
    phone?: string;
    branchId: string;
    branch: string;
    roles: string[];
    status: UserStatus;
}
import UserCreateModal from "@/components/admin/UserCreateModal";
import UserEditModal from "@/components/admin/UserEditModal";
import ResetPasswordModal from "@/components/admin/ResetPasswordModal";

const SKELETON_ROWS = 6;

const TAB_OPTIONS: { value: Tab; label: string }[] = [
    { value: "directory", label: "User directory" },
    { value: "matrix", label: "Global role matrix" },
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(ASSIGNABLE_ROLES.map((r) => [r.value, r.label]));

/** Friendly label for a realm role code, falling back to the raw code for anything not in ASSIGNABLE_ROLES (e.g. SUPER_ADMIN, which this UI doesn't assign but may still need to display). */
function roleLabel(role: string): string {
    return ROLE_LABELS[role] ?? role;
}

function toRecord(u: AdminUser): UserRecord {
    return {
        id: u.id,
        name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username,
        email: u.email ?? "—",
        branch: u.branchCode ?? "—",
        roles: u.roles ?? [],
        status: u.enabled ? "ACTIVE" : "INACTIVE",
    };
}

export default function GlobalUserControlPage() {
    const { user: authUser } = useAuth();
    const [activeTab, setActiveTab] = useState<"directory" | "matrix">("directory");
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

    // Search & Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [branchFilter, setBranchFilter] = useState("All Branches");
    const [roleFilter, setRoleFilter] = useState("All Roles");
    
    // Data states for filters
    const [branches, setBranches] = useState<BranchResponse[]>([]);
    const [roles, setRoles] = useState<string[]>([]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const [usersData, branchesData, rolesData] = await Promise.all([
                getSuperadminUsers(),
                getBranches().catch(() => ({ content: [] as BranchResponse[] })),
                getSuperadminRoles().catch(() => [])
            ]);

            const fetchedBranches = branchesData.content || [];
            setBranches(fetchedBranches);
            setRoles(rolesData);

            const mappedUsers: UserRecord[] = usersData.map(u => {
                let branchName = "Not Assigned";
                if (u.branchId) {
                    const foundBranch = fetchedBranches.find((b: BranchResponse) => b.id.toString() === u.branchId);
                    branchName = foundBranch ? foundBranch.name : `Branch ${u.branchId}`;
                }

                return {
                    id: u.id,
                    username: u.username || "Unknown",
                    name: u.fullName || u.username || "Unknown",
                    email: u.email || "",
                    branchId: u.branchId || "",
                    branch: branchName,
                    roles: u.roles || [],
                    status: u.isActive ? "ACTIVE" : "INACTIVE",
                    lastLogin: "N/A"
                };
            });

            setUsers(mappedUsers);
        } catch (error) {
            console.error("Failed to load users", error);
            toast.error("Failed to load user directory.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(u => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = !query || 
            u.name.toLowerCase().includes(query) || 
            u.username.toLowerCase().includes(query) || 
            u.email.toLowerCase().includes(query);
            
        const matchesBranch = branchFilter === "All Branches" || u.branch === branchFilter;
        const matchesRole = roleFilter === "All Roles" || (u.roles && u.roles.includes(roleFilter));

        return matchesSearch && matchesBranch && matchesRole;
    });

    const handleUpdateUser = async (id: string, data: Partial<UserRecord>) => {
        try {
            const backendData = {
                fullName: data.name || "",
                email: data.email || "",
                role: data.roles?.[0] || "",
                isActive: data.status === "ACTIVE",
                branchId: ""
            };

            // Map branch strings to IDs
            if (data.branchId) {
                backendData.branchId = data.branchId;
            } else if (data.branch && data.branch.includes("Branch ")) {
                const parsedId = data.branch.replace("Branch ", "");
                backendData.branchId = parsedId;
            }

            await updateSuperadminUser(id, backendData);
            toast.success("User updated successfully", { position: 'top-right' });
            await fetchUsers(); // Refresh the table
        } catch (error: any) {
            console.error("Failed to update user", error);
            toast.error(error?.response?.data?.message || error.message || "Failed to update user.", { position: 'top-right' });
            throw error;
        }
    };

    const handleToggleStatus = async (user: UserRecord) => {
        const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
            const backendData = {
                fullName: user.name,
                email: user.email,
                phone: user.phone || "",
                role: user.roles?.[0] || "",
                isActive: newStatus === "ACTIVE",
                branchId: user.branchId || ""
            };

            await updateSuperadminUser(user.id, backendData);
            toast.success(`User successfully ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`, { position: 'top-right' });
            await fetchUsers(); // Refresh the table
        } catch (error: any) {
            console.error("Failed to toggle user status", error);
            toast.error(error?.response?.data?.message || error.message || "Failed to update user status.", { position: 'top-right' });
        }
    };

    const handleEditClick = (user: UserRecord) => {
        setSelectedUser(user);
        setIsEditModalOpen(true);
    };

    const handleResetPasswordClick = (user: UserRecord) => {
        setSelectedUser(user);
        setIsResetPasswordModalOpen(true);
    };

    const handleConfirmResetPassword = async (userId: string, password: string, adminUsername: string, adminPassword: string): Promise<boolean> => {
        try {
            if (!authUser?.preferred_username) {
                return false;
            }

            const expectedUsername = authUser.preferred_username.trim().toLowerCase();
            const providedUsername = adminUsername.trim().toLowerCase();

            if (providedUsername !== expectedUsername) {
                toast.error("Username does not match your active session.", { position: 'top-right' });
                return false;
            }
            
            // Perform the reset (backend will verify the adminPassword)
            await resetSuperadminUserPassword(userId, password, adminPassword);
            toast.success(`Password successfully reset to '${password}'`, { position: 'top-right' });
            return true;
        } catch (error: any) {
            console.error("Failed to reset password", error);
            if (error?.response?.data?.message?.includes("Incorrect admin password") || error?.response?.status === 401 || error?.response?.status === 400) {
                toast.error("Incorrect admin password. Verification failed.", { position: 'top-right' });
            } else {
                toast.error(error?.response?.data?.message || error.message || "Failed to reset password.", { position: 'top-right' });
            }
            return false;
        }
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
                    <span className="text-slate-800 font-bold">User & Role Control</span>
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Global User & Role Control</h1>
                <p className="text-sm font-medium text-slate-500 mt-1 pb-4">Centralized identity and access management for all hospital branches.</p>

                {/* Tabs */}
                <div className="flex items-center gap-6 border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab("directory")}
                        className={`pb-3 text-sm font-bold transition-all border-b-2 px-1 ${activeTab === "directory"
                            ? "text-blue-600 border-blue-600"
                            : "text-slate-500 border-transparent hover:text-slate-800"
                            }`}
                    >
                        User Directory
                    </button>
                    <button
                        onClick={() => setActiveTab("matrix")}
                        className={`pb-3 text-sm font-bold transition-all border-b-2 px-1 ${activeTab === "matrix"
                            ? "text-blue-600 border-blue-600"
                            : "text-slate-500 border-transparent hover:text-slate-800"
                            }`}
                    >
                        Global Role Matrix
                    </button>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="bg-white border text-sm border-slate-200 shadow-sm rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">

                {/* Search */}
                <div className="relative flex-1 max-w-[500px]">
                    <span className="material-icons text-sm absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        type="text"
                        placeholder="Search by name, ID or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-slate-50 border border-slate-100 text-slate-800 font-semibold py-2.5 pl-10 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full placeholder:text-slate-400 placeholder:font-medium"
                    />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Branch Filter */}
                    <div className="relative w-full sm:w-[180px]">
                        <select 
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                            className="w-full appearance-none bg-slate-50 border border-slate-100 text-slate-800 font-bold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        >
                            <option value="All Branches">All Branches</option>
                            {branches.map(b => (
                                <option key={b.code} value={b.name}>{b.name}</option>
                            ))}
                        </select>
                        <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                    </div>

                    {/* Role Filter */}
                    <div className="relative w-full sm:w-[180px]">
                        <select 
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="w-full appearance-none bg-slate-50 border border-slate-100 text-slate-800 font-bold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        >
                            <option value="All Roles">All Roles</option>
                            {roles.map(r => (
                                <option key={r} value={r}>{r}</option>
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
                                Name column at every band. lg reveals Roles (w-48), pushing the fixed
                                sum to 624px, so the table needs >=792px there. Last login isn't a
                                column: the Keycloak admin API this page reads from doesn't expose a
                                per-user last-login timestamp, so showing one would just be another
                                permanently-empty field. */}
                            <table className="w-full min-w-[760px] table-fixed text-left text-sm lg:min-w-[792px]">
                                <caption className="sr-only">User directory</caption>
                                <thead>
                                    <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                        <th scope="col" className="w-28 py-2 pl-4 pr-3 font-semibold">
                                            User ID
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                            Name
                                        </th>
                                        <th scope="col" className="hidden w-28 px-3 py-2 font-semibold md:table-cell">
                                            Branch
                                        </th>
                                        <th scope="col" className="hidden w-48 px-3 py-2 font-semibold lg:table-cell">
                                            Roles
                                        </th>
                                        <th scope="col" className="w-24 px-3 py-2 font-semibold">
                                            Status
                                        </th>
                                        <th scope="col" className="w-28 py-2 pl-3 pr-4 text-right font-semibold">
                                            Actions
                                        </th>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-slate-500 font-medium text-[13px]">
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="py-4 px-6">
                                                <span className="text-[13px] font-extrabold text-blue-600">{user.id}</span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[14px] font-bold text-slate-900 leading-snug">{user.name}</span>
                                                    <span className="text-[12px] font-medium text-slate-500">{user.email}</span>
                                                    <span className="text-[11px] font-semibold text-slate-400">{user.username}</span>
                                                    {user.phone && <span className="text-[11px] font-semibold text-slate-400">{user.phone}</span>}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="text-[13px] font-semibold text-slate-700">{user.branch}</span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-wrap gap-2">
                                                    {user.roles && Array.isArray(user.roles) ? user.roles.map(role => (
                                                        <span key={role} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                                                            {role}
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
                                                                <StatusChip key={role} size="sm" title={role}>
                                                                    {roleLabel(role)}
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

            {/* Empty State for Matrix Tab */}
            {activeTab === "matrix" && (
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 mb-4">
                        <span className="material-icons text-3xl">grid_view</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mb-2">Global Role Matrix Configuration</h2>
                    <p className="text-sm font-medium text-slate-500 max-w-md">The master matrix configuration panel is accessed via the specific role definition portal.</p>
                </div>
            )}

            {/* Custom Footer */}
            <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs font-semibold text-slate-400 gap-4">
                <div className="flex items-center gap-2">
                    <span>&copy; 2023 Durdans Hospital. Global Admin Suite V 3.1.0</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="flex items-center gap-1.5">
                        Security Status: <span className="text-emerald-500 font-bold">All Protocols Active</span>
                    </span>
                </div>
                <div className="flex items-center justify-end gap-6 flex-1">
                    <a href="#" className="hover:text-slate-600 transition-colors font-bold">Security Documentation</a>
                    <button className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg transition-colors font-bold shadow-sm">
                        Access Logs
                    </button>
                </div>
            </div>

            <UserCreateModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />

            <UserEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSaved={load}
                userData={selectedUser}
            />
        </div>
    );
}
