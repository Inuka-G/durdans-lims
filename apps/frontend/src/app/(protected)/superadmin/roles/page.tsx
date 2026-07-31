"use client";

import { useState, useMemo } from "react";
import { Toaster, toast } from 'sonner';

// Types for Mock Data
type PermissionLevel = "checked" | "unchecked" | "dash";

interface ModulePermission {
    module: string;
    icon: string;
    view: PermissionLevel;
    create: PermissionLevel;
    edit: PermissionLevel;
    delete: PermissionLevel;
    approve: PermissionLevel;
    verify: PermissionLevel;
}

const roleProfiles: Record<string, ModulePermission[]> = {
    "Branch Administrator": [
        { module: "Patient Management", icon: "person", view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "dash", verify: "dash" },
        { module: "Orders & Billing", icon: "receipt_long", view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "checked", verify: "dash" },
        { module: "Sample Collection", icon: "vaccines", view: "checked", create: "checked", edit: "unchecked", delete: "unchecked", approve: "dash", verify: "dash" },
        { module: "Accessioning", icon: "inventory_2", view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "dash", verify: "dash" },
        { module: "MLT Processing", icon: "science", view: "checked", create: "unchecked", edit: "unchecked", delete: "unchecked", approve: "dash", verify: "dash" },
        { module: "Verification", icon: "fact_check", view: "checked", create: "dash", edit: "unchecked", delete: "unchecked", approve: "dash", verify: "checked" },
        { module: "Report Dispatch", icon: "send", view: "checked", create: "unchecked", edit: "unchecked", delete: "unchecked", approve: "checked", verify: "dash" },
    ],
    "Pharmacist": [
        { module: "Patient Management", icon: "person", view: "checked", create: "unchecked", edit: "unchecked", delete: "unchecked", approve: "dash", verify: "dash" },
        { module: "Orders & Billing", icon: "receipt_long", view: "checked", create: "unchecked", edit: "unchecked", delete: "unchecked", approve: "unchecked", verify: "dash" },
        { module: "Inventory", icon: "inventory", view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "unchecked", verify: "dash" },
    ],
    "Physician": [
        { module: "Patient Management", icon: "person", view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "dash", verify: "dash" },
        { module: "Clinical History", icon: "history", view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "dash", verify: "checked" },
        { module: "Prescriptions", icon: "medical_services", view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "dash", verify: "dash" },
    ]
};

export default function RolePermissionsPage() {
    const [selectedRole, setSelectedRole] = useState("Branch Administrator");
    const [searchQuery, setSearchQuery] = useState("");
    const [permissions, setPermissions] = useState<ModulePermission[]>(roleProfiles["Branch Administrator"]);
    const [isSaving, setIsSaving] = useState(false);

    // Filter permissions based on search query
    const filteredPermissions = useMemo(() => {
        return permissions.filter(p =>
            p.module.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [permissions, searchQuery]);

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRole = e.target.value;
        setSelectedRole(newRole);
        // Load the profile for the selected role
        setPermissions(roleProfiles[newRole] || []);
        setSearchQuery(""); // Reset search when switching roles
    };

    const handleSave = async () => {
        setIsSaving(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success(`Permissions saved for ${selectedRole}`);
        setIsSaving(false);
    };

    const togglePermission = (moduleName: string, field: keyof Omit<ModulePermission, "module" | "icon">) => {
        setPermissions(prev => prev.map(item => {
            if (item.module === moduleName) {
                const currentVal = item[field];
                if (currentVal === "dash") return item; // Cannot toggle dashed items
                return {
                    ...item,
                    [field]: currentVal === "checked" ? "unchecked" : "checked"
                };
            }
            return item;
        }));
    };

    const renderCheckbox = (val: PermissionLevel, onClick: () => void) => {
        if (val === "dash") {
            return (
                <div className="w-5 h-5 flex items-center justify-center opacity-30 select-none">
                    <span className="w-2.5 h-[2px] bg-slate-400 rounded-full"></span>
                </div>
            );
        }

        if (val === "checked") {
            return (
                <button
                    onClick={onClick}
                    className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center shadow-sm hover:bg-blue-600 transition-colors focus:ring-2 focus:ring-blue-500/30 outline-none"
                >
                    <span className="material-icons text-white text-[14px]">check</span>
                </button>
            );
        }

        return (
            <button
                onClick={onClick}
                className="w-5 h-5 bg-white border-2 border-slate-200 rounded hover:border-blue-400 transition-colors focus:ring-2 focus:ring-blue-500/30 outline-none"
            />
        );
    };

    return (
        <div className="max-w-[1280px] mx-auto w-full font-sans text-slate-900 min-h-[calc(100vh-136px)] pt-2 pb-10">
            <Toaster position="top-right" />

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Role Permission Matrix – Global</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Configure granular access control for system modules and user roles.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm shadow-blue-500/30 active:scale-95"
                >
                    {isSaving ? (
                        <span className="material-icons text-[18px] animate-spin">sync</span>
                    ) : (
                        <span className="material-icons text-[18px]">lock</span>
                    )}
                    {isSaving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            {/* Controls Bar */}
            <div className="bg-white border text-sm border-slate-200 shadow-sm rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-8">
                    {/* Role Selector */}
                    <div className="flex flex-col gap-1.5 min-w-[280px]">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Select Role</label>
                        <div className="relative">
                            <select
                                value={selectedRole}
                                onChange={handleRoleChange}
                                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 font-bold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                            >
                                {Object.keys(roleProfiles).map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                        </div>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">View Mode</label>
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                            <button className="px-4 py-1.5 text-xs font-bold bg-white text-blue-600 shadow-sm rounded-lg w-full text-center">Matrix View</button>
                        </div>
                    </div>
                </div>

                {/* Filter */}
                <div className="flex items-center">
                    <div className="relative">
                        <span className="material-icons text-sm absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">filter_alt</span>
                        <input
                            type="text"
                            placeholder="Filter permissions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-800 font-semibold py-2.5 pl-10 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full md:w-[280px] placeholder:text-slate-400 placeholder:font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Permission Matrix Table */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest min-w-[240px]">System Module</th>
                                <th className="py-4 px-4 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-center w-[100px]">View</th>
                                <th className="py-4 px-4 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-center w-[100px]">Create</th>
                                <th className="py-4 px-4 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-center w-[100px]">Edit</th>
                                <th className="py-4 px-4 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-center w-[100px]">Delete</th>
                                <th className="py-4 px-4 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-center w-[100px]">Approve</th>
                                <th className="py-4 px-4 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-center w-[100px]">Verify</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredPermissions.length > 0 ? (
                                filteredPermissions.map((item) => (
                                    <tr key={item.module} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <span className="material-icons text-slate-400 group-hover:text-blue-500 transition-colors text-lg">{item.icon}</span>
                                                <span className="text-[13px] font-extrabold text-slate-800">{item.module}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <div className="flex justify-center">
                                                {renderCheckbox(item.view, () => togglePermission(item.module, 'view'))}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <div className="flex justify-center">
                                                {renderCheckbox(item.create, () => togglePermission(item.module, 'create'))}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <div className="flex justify-center">
                                                {renderCheckbox(item.edit, () => togglePermission(item.module, 'edit'))}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center border-x border-slate-50/50">
                                            <div className="flex justify-center">
                                                {renderCheckbox(item.delete, () => togglePermission(item.module, 'delete'))}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <div className="flex justify-center">
                                                {renderCheckbox(item.approve, () => togglePermission(item.module, 'approve'))}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <div className="flex justify-center">
                                                {renderCheckbox(item.verify, () => togglePermission(item.module, 'verify'))}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-500 text-sm font-medium bg-slate-50/30">
                                        No permissions matched your search query.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
