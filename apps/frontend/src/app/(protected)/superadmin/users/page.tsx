"use client";

import { useCallback, useEffect, useState } from "react";
import UserCreateModal from "@/components/admin/UserCreateModal";
import UserEditModal from "@/components/admin/UserEditModal";
import { getAdminUsers, setAdminUserEnabled, AdminUser } from "@/lib/api";

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
    const [activeTab, setActiveTab] = useState<"directory" | "matrix">("directory");
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                    {/* Refresh */}
                    <button
                        onClick={load}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold transition-colors"
                    >
                        <span className="material-icons text-[18px]">refresh</span>
                        Refresh
                    </button>

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
                    {error && (
                        <div className="m-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold px-4 py-3">
                            {error}
                        </div>
                    )}
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : users.length === 0 && !error ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                            <span className="material-icons text-4xl text-slate-300 mb-2">group_off</span>
                            <p className="text-sm font-semibold text-slate-500">No users found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[1000px]">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/50">
                                        <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Username</th>
                                        <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Name</th>
                                        <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Branch</th>
                                        <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Assigned Roles</th>
                                        <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Status</th>
                                        <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Last Login</th>
                                        <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {users.map((user) => (
                                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="py-4 px-6">
                                                <span className="text-[13px] font-extrabold text-blue-600">{user.id.slice(0, 8)}</span>
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
                                                    {user.roles.length === 0 ? (
                                                        <span className="text-[12px] text-slate-400">—</span>
                                                    ) : user.roles.map(role => (
                                                        <span key={role} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                                                            {role}
                                                        </span>
                                                    ))}
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
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
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

            <UserCreateModal
                isOpen={isCreateModalOpen}
                onClose={() => { setIsCreateModalOpen(false); load(); }}
            />

            <UserEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                userData={selectedUser}
            />
        </div>
    );
}
