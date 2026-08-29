"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import CreateUserModal from "@/components/branch/CreateUserModal";
import ViewEditUserModal from "@/components/branch/ViewEditUserModal";

import { getBranchUsers, createBranchUser, updateBranchUser, BranchUser, getBranches } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_BRANCH_ID = "b6030d28-10ef-4165-9554-8887fabfddb8";

export default function BranchUserManagementPage() {
    const { branchCode } = useAuth();
    const activeBranchId = branchCode || DEFAULT_BRANCH_ID;
    const [branchName, setBranchName] = useState("Loading...");

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
            const data = await getBranchUsers(activeBranchId);
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
        getBranches(0, 100).then((data) => {
            const branch = data.content.find((b) => b.id === activeBranchId || b.code.toUpperCase() === activeBranchId.toUpperCase());
            if (branch) {
                setBranchName(branch.name);
            } else {
                setBranchName(activeBranchId);
            }
        }).catch(err => {
            console.error("Failed to fetch branch details", err);
            setBranchName(activeBranchId);
        });
        fetchUsers();
    }, [activeBranchId]);

    // Filter users based on search query and dropdowns
    const filteredUsers = users.filter(user => {
        const query = searchQuery.toLowerCase();
        const matchesQuery = (user.firstName?.toLowerCase() || "").includes(query) ||
            (user.lastName?.toLowerCase() || "").includes(query) ||
            (user.email?.toLowerCase() || "").includes(query) ||
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
                firstName: user.firstName,
                lastName: user.lastName,
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
            await createBranchUser(activeBranchId, userData);
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
                    <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">User Management – {branchName}</h1>
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

                <div className="flex items-center gap-3">
                    {/* Role Filter */}
                    <div className="relative w-[160px]">
                        <select
                            value={selectedRoleFilter}
                            onChange={(e) => setSelectedRoleFilter(e.target.value)}
                            className="w-full appearance-none bg-white border border-[#ecf0f6] text-[#475569] font-bold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all cursor-pointer text-[13px]"
                        >
                            <option value="All Roles">All Roles</option>
                            <option value="Pathologist">Pathologist</option>
                            <option value="Lab Technician">Lab Technician</option>
                            <option value="Receptionist">Receptionist</option>
                            <option value="Clerk">Clerk</option>
                        </select>
                        <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none text-lg">expand_more</span>
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
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[12.5%]">First Name</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[12.5%]">Last Name</th>
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
                                            <span className="text-[13px] font-bold text-[#64748b]" title={user.id}>
                                                {user.id?.length > 8 ? user.id.slice(0, 8) + '...' : user.id}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full ${user.bgColor || 'bg-blue-100'} ${user.textColor || 'text-blue-600'} flex items-center justify-center text-[10px] font-extrabold`}>
                                                    {user.initials || `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || '?'}
                                                </div>
                                                <span className="text-[14px] font-extrabold text-[#0f172a]">{user.firstName || ''}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-[14px] font-extrabold text-[#0f172a]">{user.lastName || ''}</span>
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
                branchName={branchName}
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
