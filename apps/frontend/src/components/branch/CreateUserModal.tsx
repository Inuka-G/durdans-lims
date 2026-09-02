"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { BranchUser, getSuperadminRoles } from "@/lib/api";

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: (userData: Partial<BranchUser>) => void;
    branchName?: string;
}

export default function CreateUserModal({ isOpen, onClose, onSave, branchName }: CreateUserModalProps) {
    const [isAccountActive, setIsAccountActive] = useState(true);
    const [selectedRole, setSelectedRole] = useState<string>("");
    const [roleOptions, setRoleOptions] = useState<string[]>([]);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        username: "",
    });

    useEffect(() => {
        if (isOpen) {
            getSuperadminRoles()
                .then(roles => {
                    const filteredRoles = roles.filter(r => r !== "SUPER_ADMIN" && r !== "BRANCH_ADMIN" && r !== "BRANCH");
                    setRoleOptions(filteredRoles);
                })
                .catch(err => {
                    console.error("Failed to fetch roles", err);
                    toast.error("Failed to load roles");
                });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleRoleChange = (role: string) => {
        setSelectedRole(role);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !selectedRole) {
            toast.error("Please fill in all required fields (First Name, Last Name, Email, and Role)");
            return;
        }

        if (onSave) {
            onSave({
                ...formData,
                role: selectedRole,
                isActive: isAccountActive
            });
        }
        onClose();
    };



    return (
        <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">

            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[900px] flex flex-col max-h-[90vh] overflow-hidden font-sans animation-scale-up">

                {/* Header */}
                <div className="p-6 border-b border-[#ecf0f6] flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-[#1277E1] rounded-2xl flex items-center justify-center">
                            <span className="material-icons text-[24px]">person_add</span>
                        </div>
                        <div>
                            <h2 className="text-[20px] font-extrabold text-[#0f172a] tracking-tight">Create New User</h2>
                            <p className="text-[13px] font-medium text-[#64748b]">Add a new staff member to the {branchName || "selected"} system.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f8fafc] p-2 rounded-xl transition-colors"
                    >
                        <span className="material-icons text-[24px]">close</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-white grid grid-cols-1 md:grid-cols-2 gap-12">

                    {/* Left Column - Basic Information */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-[10px] font-extrabold text-[#1277E1] bg-blue-50 px-2 py-0.5 rounded uppercase tracking-widest">STEP 1</span>
                            <h3 className="text-[13px] font-extrabold text-[#0f172a]">BASIC INFORMATION</h3>
                        </div>

                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">FIRST NAME</label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Maithree"
                                        className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all placeholder:text-[#cbd5e1] placeholder:font-medium text-[14px]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">LAST NAME</label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Perera"
                                        className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all placeholder:text-[#cbd5e1] placeholder:font-medium text-[14px]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">EMAIL ADDRESS</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        placeholder="m.perera@durdans.com"
                                        className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all placeholder:text-[#cbd5e1] placeholder:font-medium text-[14px]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">PHONE NUMBER</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        placeholder="+94 77 123 4567"
                                        className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all placeholder:text-[#cbd5e1] placeholder:font-medium text-[14px]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">USERNAME</label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleInputChange}
                                        placeholder="mperera_lab"
                                        className="w-full bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all placeholder:text-[#cbd5e1] placeholder:font-medium text-[14px]"
                                    />
                                </div>
                                <div className="flex items-end h-[74px]">
                                    <div className="w-full bg-white border border-[#e2e8f0] py-3 px-4 rounded-xl flex items-center justify-between">
                                        <span className="text-[14px] font-bold text-[#475569]">Account Status</span>
                                        {/* Toggle Switch */}
                                        <button
                                            onClick={() => setIsAccountActive(!isAccountActive)}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1277E1]/30 ${isAccountActive ? 'bg-[#1277E1]' : 'bg-slate-200'
                                                }`}
                                        >
                                            <span className="sr-only">Toggle account status</span>
                                            <span
                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out border border-white ${isAccountActive ? 'translate-x-[10px]' : '-translate-x-[10px]'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#f0f9ff] border border-[#e0f2fe] rounded-xl p-4 flex gap-3 items-start mt-6">
                                <span className="material-icons text-[#0ea5e9] text-[18px]">info</span>
                                <p className="text-[12px] font-semibold text-[#0284c7] leading-relaxed">
                                    An automated invitation email will be sent to the user to set their initial password after the account is created.
                                </p>
                            </div>
                        </div>

                    </div>

                    {/* Right Column - Role Assignment */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-[10px] font-extrabold text-[#1277E1] bg-blue-50 px-2 py-0.5 rounded uppercase tracking-widest">STEP 2</span>
                            <h3 className="text-[13px] font-extrabold text-[#0f172a]">ROLE ASSIGNMENT</h3>
                        </div>

                        <div className="space-y-3">
                            {roleOptions.map((role) => {
                                const isSelected = selectedRole === role;
                                return (
                                    <div
                                        key={role}
                                        onClick={() => handleRoleChange(role)}
                                        className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${isSelected
                                            ? "bg-[#f8fafc] border-[#1277E1] shadow-[0_0_0_1px_rgba(18,119,225,1)]"
                                            : "bg-white border-[#e2e8f0] hover:bg-[#f8fafc] hover:border-[#cbd5e1]"
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isSelected ? "bg-[#1277E1]" : "bg-white border-2 border-[#cbd5e1]"
                                            }`}>
                                            {isSelected && <span className="material-icons text-white text-[16px]">check</span>}
                                        </div>
                                        <span className={`text-[14px] font-bold ${isSelected ? "text-[#1277E1]" : "text-[#475569]"
                                            }`}>
                                            {role}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-[#ecf0f6] bg-[#f8fafc] flex justify-end items-center gap-4 relative z-10">
                    <button
                        onClick={onClose}
                        className="text-[#64748b] hover:text-[#0f172a] font-bold px-6 py-2.5 rounded-xl transition-colors text-[14px]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center justify-center gap-2 bg-[#1277E1] hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-sm active:scale-95 text-[14px]"
                    >
                        <span className="material-icons text-[18px]">save</span>
                        Save User
                    </button>
                </div>

            </div>
        </div>
    );
}
