"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import CreateUserModal from "@/components/branch/CreateUserModal";
import ViewEditUserModal from "@/components/branch/ViewEditUserModal";

import { getBranchUsers, createBranchUser, updateBranchUser, BranchUser } from "@/lib/api";

const BRANCH_ID = "COL-1";

export default function BranchUserManagementPage() {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Modal states for View/Edit
    const [viewEditModalConfig, setViewEditModalConfig] = useState<{
        isOpen: boolean;
        mode: 'view' | 'edit';
        user: BranchUser | null;
    }>({
        isOpen: false,
        mode: 'view',
        user: null
    });

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRoleFilter, setSelectedRoleFilter] = useState("All Roles");
    const [selectedStatusFilter, setSelectedStatusFilter] = useState("All Status");

    const [users, setUsers] = useState<BranchUser[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getBranchUsers(BRANCH_ID);
            console.log("Fetched users:", data);
            setUsers(data);
        } catch (error: any) {
            console.error("Failed to fetch users", error);
            const msg = error.response?.data?.message || "Failed to load users. Please check if the backend is running.";
            toast.error(msg, { position: 'top-right' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter users based on search query and dropdowns
    const filteredUsers = users.filter(user => {
        const query = searchQuery.toLowerCase();
        const matchesQuery = user.fullName.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query) ||
            (user.id && user.id.toLowerCase().includes(query));

        const matchesRole = selectedRoleFilter === "All Roles" ||
            user.role === selectedRoleFilter ||
            (selectedRoleFilter === "Clerk" && user.role?.includes("CLERK")) ||
            (selectedRoleFilter === "Pathologist" && user.role?.includes("PATHOLOGIST")) ||
            (selectedRoleFilter === "Lab Technician" && user.role?.includes("TECHNICIAN")) ||
            (selectedRoleFilter === "Receptionist" && user.role?.includes("RECEPTIONIST"));

        const matchesStatus = selectedStatusFilter === "All Status" ||
            (selectedStatusFilter === "Active" && user.isActive) ||
            (selectedStatusFilter === "Disabled" && !user.isActive);

        return matchesQuery && matchesRole && matchesStatus;
    });

    // Action Handlers
    const handleResetPassword = (user: BranchUser) => {
        toast.success(`Password reset link sent to ${user.email}`, { position: 'top-right' });
    };

    const handleToggleStatus = async (user: BranchUser) => {
        const userId = user.id || user.email;
        try {
            const payload = {
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                phone: user.phone || undefined,
                username: user.username || undefined,
                isActive: !user.isActive
            };
            await updateBranchUser(userId, payload);
            toast.success(`User ${user.isActive ? 'disabled' : 'enabled'} successfully!`, { position: 'top-right' });
            fetchUsers(); // Refresh the list
        } catch (error: any) {
            console.error("Failed to toggle user status", error);
            const msg = error.response?.data?.message || "Failed to update user status.";
            toast.error(msg, { position: 'top-right' });
        }
    };

    const handleViewUser = (user: BranchUser) => {
        setViewEditModalConfig({ isOpen: true, mode: 'view', user });
    };

    const handleEditUser = (user: BranchUser) => {
        setViewEditModalConfig({ isOpen: true, mode: 'edit', user });
    };

    const handleSaveUser = async (updatedUserData: any) => {
        const userId = updatedUserData.id || updatedUserData.email;
        try {
            await updateBranchUser(userId, updatedUserData);
            toast.success("User updated successfully!", { position: 'top-right' });
            fetchUsers(); // Refresh the list
        } catch (error: any) {
            console.error("Failed to update user", error);
            const msg = error.response?.data?.message || "Failed to update user details.";
            toast.error(msg, { position: 'top-right' });
        }
    };

    const handleCreateUser = async (userData: any) => {
        try {
            await createBranchUser(BRANCH_ID, userData);
            toast.success("User created successfully!", { position: 'top-right' });
            fetchUsers(); // Refresh the list
        } catch (error: any) {
            console.error("Failed to create user", error);
            const msg = error.response?.data?.message || "Failed to create user. Please check if the backend is running.";
            toast.error(msg, { position: 'top-right' });
        }
    };

    return (
        <div className="w-full bg-[#f8fafc] min-h-[calc(100vh-76px)] p-8 font-sans">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">User Management – Colombo Branch</h1>
                    <p className="text-[13px] font-medium text-[#64748b] mt-1">Manage and monitor branch administrative and medical staff accounts.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-[#1277E1] hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm active:scale-95"
                >
                    <span className="material-icons text-[18px]">person_add</span>
                    Create New User
                </button>
            </div>

            {/* Controls Bar */}
            <div className="bg-white border text-sm border-[#ecf0f6] shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">

                {/* Search */}
                <div className="relative flex-1 max-w-[600px]">
                    <span className="material-icons text-[18px] absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]">search</span>
                    <input
                        type="text"
                        placeholder="Search by name, email or user ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-[#f8fafc] border border-[#ecf0f6] text-[#0f172a] font-semibold py-2.5 pl-11 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all w-full placeholder:text-[#94a3b8] placeholder:font-medium text-[13px]"
                    />
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
                        <table className="w-full min-w-[760px] table-fixed text-left text-sm md:min-w-[820px] lg:min-w-[950px]">
                            <caption className="sr-only">Branch users observed from audit activity</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-56 py-2 pl-4 pr-3 font-semibold">
                                        Actor
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-semibold">
                                        Observed roles
                                    </th>
                                    <th scope="col" className="hidden w-24 px-3 py-2 font-semibold md:table-cell">
                                        Branch
                                    </th>
                                    <th scope="col" className="w-28 px-3 py-2 text-right font-semibold">
                                        Actions logged
                                    </th>
                                    <th scope="col" className="w-44 px-3 py-2 font-semibold">
                                        Last activity
                                    </th>
                                    <th scope="col" className="hidden w-32 px-3 py-2 font-semibold lg:table-cell">
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
                                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[12px] font-semibold text-fg-secondary ring-1 ring-inset ring-edge"
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

                    {/* Status Filter */}
                    <div className="relative w-[140px]">
                        <select
                            value={selectedStatusFilter}
                            onChange={(e) => setSelectedStatusFilter(e.target.value)}
                            className="w-full appearance-none bg-white border border-[#ecf0f6] text-[#475569] font-bold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all cursor-pointer text-[13px]"
                        >
                            <option value="All Status">All Status</option>
                            <option value="Active">Active</option>
                            <option value="Disabled">Disabled</option>
                        </select>
                        <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none text-lg">expand_more</span>
                    </div>

                    <button className="bg-white border border-[#ecf0f6] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] w-10 h-10 rounded-xl flex items-center justify-center transition-colors">
                        <span className="material-icons text-[20px]">filter_list</span>
                    </button>
                </div>
            </div>

            {/* Data Table Container */}
            <div className="bg-white border border-[#ecf0f6] shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] rounded-2xl overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="border-b border-[#ecf0f6] bg-[#f8fafc]">
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[12%]">User ID</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[25%]">Full Name</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[20%]">Email</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest flex-1">Assigned Roles</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest text-center w-[10%]">Status</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[15%]">Last Login</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest text-right w-[10%]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f8fafc]">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-[#f8fafc]/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <span className="text-[13px] font-bold text-[#64748b]">{user.id}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full ${user.bgColor || 'bg-blue-100'} ${user.textColor || 'text-blue-600'} flex items-center justify-center text-[10px] font-extrabold`}>
                                                    {user.initials || user.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                                                </div>
                                                <span className="text-[14px] font-extrabold text-[#0f172a]">{user.fullName}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-[13px] font-medium text-[#64748b]">{user.email}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col gap-1.5 items-start">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#eff6ff] text-[#1277E1]">
                                                    {user.role}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f8fafc] border ${user.isActive
                                                ? 'border-[#86efac]/30'
                                                : 'border-[#fca5a5]/30'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}></div>
                                                <span className={`text-[10px] font-extrabold uppercase tracking-widest ${user.isActive ? 'text-[#16a34a]' : 'text-[#dc2626]'
                                                    }`}>
                                                    {user.isActive ? 'ACTIVE' : 'DISABLED'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-[13px] font-medium text-[#64748b]">{user.lastLogin}</span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2 text-[#94a3b8]">
                                                <button onClick={() => handleViewUser(user)} className="hover:text-[#1277E1] transition-colors p-1" title="View User">
                                                    <span className="material-icons text-[18px]">visibility</span>
                                                </button>
                                                <button onClick={() => handleEditUser(user)} className="hover:text-[#1277E1] transition-colors p-1" title="Edit User">
                                                    <span className="material-icons text-[18px]">edit</span>
                                                </button>
                                                {user.isActive ? (
                                                    <button onClick={() => handleToggleStatus(user)} className="hover:text-[#ef4444] transition-colors p-1" title="Disable User">
                                                        <span className="material-icons text-[18px]">block</span>
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleToggleStatus(user)} className="text-[#1277E1] hover:text-[#1e40af] bg-blue-50 rounded p-1 transition-colors" title="Enable User">
                                                        <span className="material-icons text-[18px]">check_circle</span>
                                                    </button>
                                                )}
                                                <button onClick={() => handleResetPassword(user)} className="hover:text-[#f59e0b] transition-colors p-1" title="Reset Password">
                                                    <span className="material-icons text-[18px]">lock_reset</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-[#64748b] font-medium text-[13px]">
                                        No users found matching "{searchQuery}"
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-[#ecf0f6] flex items-center justify-between text-[13px]">
                    <span className="text-[#64748b] font-medium">Showing {filteredUsers.length > 0 ? 1 : 0} to {filteredUsers.length} of {users.length} results</span>
                    <div className="flex items-center gap-1 font-bold">
                        <button className="px-3 py-1.5 text-[#94a3b8] hover:text-[#0f172a] transition-colors disabled:opacity-50">Previous</button>
                        <button className="w-8 h-8 flex items-center justify-center bg-[#1277E1] text-white rounded-lg">1</button>
                        <button className="w-8 h-8 flex items-center justify-center text-[#475569] hover:bg-[#f8fafc] rounded-lg transition-colors">2</button>
                        <button className="w-8 h-8 flex items-center justify-center text-[#475569] hover:bg-[#f8fafc] rounded-lg transition-colors">3</button>
                        <button className="px-3 py-1.5 text-[#475569] hover:text-[#0f172a] transition-colors">Next</button>
                    </div>
                </div>
            </div>

            {/* Create Modal */}
            <CreateUserModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSave={handleCreateUser}
            />

            {/* View/Edit Modal */}
            <ViewEditUserModal
                isOpen={viewEditModalConfig.isOpen}
                onClose={() => setViewEditModalConfig({ ...viewEditModalConfig, isOpen: false })}
                mode={viewEditModalConfig.mode}
                userData={viewEditModalConfig.user}
                onSave={handleSaveUser}
            />

        </div>
    );
}
