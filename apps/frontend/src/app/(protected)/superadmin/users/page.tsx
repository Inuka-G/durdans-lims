"use client";

import { useState, useEffect } from "react";

// Types for Mock Data
type UserStatus = "ACTIVE" | "INACTIVE";

interface UserRecord {
    id: string;
    name: string;
    email: string;
    branch: string;
    roles: string[];
    status: UserStatus;
    lastLogin: string;
}
import UserCreateModal from "@/components/admin/UserCreateModal";
import UserEditModal from "@/components/admin/UserEditModal";

import toast from "react-hot-toast";

const getSuperadminUsers = async (): Promise<any[]> => {
    return [
        { id: "1", fullName: "Super Admin", email: "super@admin.com", branchId: 1, role: "SUPERADMIN", isActive: true }
    ];
};

const updateSuperadminUser = async (id: string, data: any): Promise<any> => {
    return { ...data, id };
};

export default function GlobalUserControlPage() {
    const [activeTab, setActiveTab] = useState<"directory" | "matrix">("directory");
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getSuperadminUsers();
            
            let rawData: any[] = [];
            if (Array.isArray(data)) {
                rawData = data;
            } else if (data && typeof data === 'object' && 'content' in data && Array.isArray((data as any).content)) {
                rawData = (data as any).content;
            }
            
            const mappedUsers: UserRecord[] = rawData.map(u => ({
                id: u.id ? String(u.id) : "",
                name: u.fullName || u.username || "Unknown",
                email: u.email || "",
                branch: u.branchId ? `Branch ${u.branchId}` : "Colombo",
                roles: u.role ? [u.role] : [],
                status: u.isActive ? "ACTIVE" : "INACTIVE",
                lastLogin: "N/A"
            }));
            
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

    const handleUpdateUser = async (id: string, data: Partial<UserRecord>) => {
        try {
            const backendData = {
                fullName: data.name,
                email: data.email,
                role: data.roles?.[0] || "FRONT_DESK",
                isActive: data.status === "ACTIVE"
            };
            
            // Map branch strings to IDs (simple mockup, usually from a branch list)
            if (data.branch) {
                if (data.branch.includes("Colombo")) (backendData as any).branchId = 1;
                else if (data.branch.includes("Kandy")) (backendData as any).branchId = 2;
                else if (data.branch.includes("Galle")) (backendData as any).branchId = 3;
                else if (data.branch.includes("Branch ")) {
                    const parsedId = parseInt(data.branch.replace("Branch ", ""));
                    if (!isNaN(parsedId)) (backendData as any).branchId = parsedId;
                }
            }
            
            await updateSuperadminUser(id, backendData);
            toast.success("User updated successfully");
            await fetchUsers(); // Refresh the table
        } catch (error) {
            console.error("Failed to update user", error);
            toast.error("Failed to update user.");
            throw error;
        }
    };

    const handleToggleStatus = (userId: string) => {
        setUsers(users.map(user =>
            user.id === userId
                ? { ...user, status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
                : user
        ));
    };

    const handleEditClick = (user: UserRecord) => {
        setSelectedUser(user);
        setIsEditModalOpen(true);
    };

    const handleResetPassword = (userId: string, userName: string) => {
        alert(`Password reset link sent to ${userName} (${userId})`);
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
                        className="bg-slate-50 border border-slate-100 text-slate-800 font-semibold py-2.5 pl-10 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full placeholder:text-slate-400 placeholder:font-medium"
                    />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Branch Filter */}
                    <div className="relative w-full sm:w-[180px]">
                        <select className="w-full appearance-none bg-slate-50 border border-slate-100 text-slate-800 font-bold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                            <option>All Branches</option>
                            <option>Colombo</option>
                            <option>Kandy</option>
                            <option>Galle</option>
                        </select>
                        <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                    </div>

                    {/* Role Filter */}
                    <div className="relative w-full sm:w-[180px]">
                        <select className="w-full appearance-none bg-slate-50 border border-slate-100 text-slate-800 font-bold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                            <option>All Roles</option>
                            <option>Consultant</option>
                            <option>Branch Admin</option>
                            <option>Nursing Head</option>
                        </select>
                        <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                    </div>

                    {/* Create Button */}
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm shadow-blue-500/30 active:scale-95 whitespace-nowrap"
                    >
                        <span className="material-icons text-[18px]">person_add</span>
                        Create New User
                    </button>
                </div>
            </div>

            {/* Data Table */}
            {activeTab === "directory" && (
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50">
                                    <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">User ID</th>
                                    <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Name</th>
                                    <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Branch</th>
                                    <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Assigned Roles</th>
                                    <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Status</th>
                                    <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Last Login</th>
                                    <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center">
                                            <span className="material-icons animate-spin text-blue-600 text-3xl">sync</span>
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-slate-500 font-medium text-[13px]">
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <span className="text-[13px] font-extrabold text-blue-600">{user.id}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-[14px] font-bold text-slate-900 leading-snug">{user.name}</span>
                                                <span className="text-[12px] font-medium text-slate-500">{user.email}</span>
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
                                                )) : (
                                                    <span className="text-[10px] text-slate-400">No roles assigned</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.status === 'ACTIVE'
                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                }`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-[12px] font-semibold text-slate-500">{user.lastLogin}</span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <button
                                                    onClick={() => handleEditClick(user)}
                                                    className="text-slate-400 hover:text-blue-600 transition-colors p-1" title="Edit User"
                                                >
                                                    <span className="material-icons text-[18px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleResetPassword(user.id, user.name)}
                                                    className="text-slate-400 hover:text-slate-800 transition-colors p-1" title="Reset Password"
                                                >
                                                    <span className="material-icons text-[18px]">history</span>
                                                </button>
                                                {user.status === 'ACTIVE' ? (
                                                    <button
                                                        onClick={() => handleToggleStatus(user.id)}
                                                        className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Deactivate User"
                                                    >
                                                        <span className="material-icons text-[18px]">person_off</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleToggleStatus(user.id)}
                                                        className="text-emerald-500/70 hover:text-emerald-600 bg-emerald-50 rounded transition-colors p-1" title="Activate User"
                                                    >
                                                        <span className="material-icons text-[18px]">person_add</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )))}
                            </tbody>
                        </table>
                    </div>
                </div>
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
                userData={selectedUser}
                onSave={handleUpdateUser}
            />
        </div>
    );
}
