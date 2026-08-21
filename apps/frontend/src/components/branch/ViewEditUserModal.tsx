"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { BranchUser } from "@/lib/api";

interface ViewEditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'view' | 'edit';
    userData: BranchUser | null;
    onSave?: (updatedData: Partial<BranchUser>) => void;
}

export default function ViewEditUserModal({ isOpen, onClose, mode, userData, onSave }: ViewEditUserModalProps) {
    const [isAccountActive, setIsAccountActive] = useState(true);
    const [selectedRole, setSelectedRole] = useState<string>("");
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: "",
        username: "",
    });

    useEffect(() => {
        if (userData && isOpen) {
            setIsAccountActive(userData.isActive);
            setSelectedRole(userData.role || "");
            setFormData({
                fullName: userData.fullName || "",
                email: userData.email || "",
                phone: userData.phone || "",
                username: userData.username || userData.email.split('@')[0],
            });
        }
    }, [userData, isOpen]);

    if (!isOpen || !userData) return null;

    const isEdit = mode === 'edit';

    const handleRoleChange = (role: string) => {
        if (!isEdit) return;
        setSelectedRole(role);
    };

    const roleOptions = [
        "FRONT_DESK",
        "BILLING",
        "PHLEBOTOMIST",
        "LAB_RECEPTIONIST",
        "LAB_TECHNICIAN",
        "LAB_SUPERVISOR",
        "PATHOLOGIST",
        "BRANCH_HEAD",
        "DATA_ENTRY"
    ];

    const handleSave = () => {
        if (!formData.fullName.trim() || !formData.email.trim() || !selectedRole) {
            toast.error("Please fill in all required fields (Full Name, Email, and Role)");
            return;
        }

        if (onSave) {
            onSave({
                ...userData,
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
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isEdit ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-[#1277E1]'}`}>
                            <span className="material-icons text-[24px]">{isEdit ? 'edit' : 'visibility'}</span>
                        </div>
                        <div>
                            <h2 className="text-[20px] font-extrabold text-[#0f172a] tracking-tight">
                                {isEdit ? 'Edit User Details' : 'User Profile Details'}
                            </h2>
                            <p className="text-[13px] font-medium text-[#64748b]">
                                {isEdit ? `Modifying settings for ${userData.id || userData.email}` : `Viewing information for ${userData.id || userData.email}`}
                            </p>
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
                            <span className="text-[10px] font-extrabold text-[#1277E1] bg-blue-50 px-2 py-0.5 rounded uppercase tracking-widest">INFO</span>
                            <h3 className="text-[13px] font-extrabold text-[#0f172a]">BASIC INFORMATION</h3>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">FULL NAME</label>
                                <input
                                    type="text"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    readOnly={!isEdit}
                                    className={`w-full border text-[#0f172a] font-bold py-3 px-4 rounded-xl focus:outline-none transition-all text-[14px] ${isEdit
                                        ? "bg-white border-[#e2e8f0] focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1]"
                                        : "bg-[#f8fafc] border-transparent cursor-default"
                                        }`}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">EMAIL ADDRESS</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        readOnly={!isEdit}
                                        className={`w-full border text-[#0f172a] font-bold py-3 px-4 rounded-xl focus:outline-none transition-all text-[14px] ${isEdit
                                            ? "bg-white border-[#e2e8f0] focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1]"
                                            : "bg-[#f8fafc] border-transparent cursor-default"
                                            }`}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">PHONE NUMBER</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        readOnly={!isEdit}
                                        className={`w-full border text-[#0f172a] font-bold py-3 px-4 rounded-xl focus:outline-none transition-all text-[14px] ${isEdit
                                            ? "bg-white border-[#e2e8f0] focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1]"
                                            : "bg-[#f8fafc] border-transparent cursor-default"
                                            }`}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">USERNAME</label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        readOnly
                                        className="w-full bg-[#f8fafc] border border-transparent text-[#64748b] font-bold py-3 px-4 rounded-xl focus:outline-none cursor-not-allowed text-[14px]"
                                    />
                                </div>
                                <div className="flex items-end h-[74px]">
                                    <div className={`w-full border py-3 px-4 rounded-xl flex items-center justify-between ${isEdit ? 'bg-white border-[#e2e8f0]' : 'bg-[#f8fafc] border-transparent'}`}>
                                        <span className={`text-[14px] font-bold ${isEdit ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>Account Status</span>
                                        {/* Toggle Switch */}
                                        <button
                                            onClick={() => setIsAccountActive(!isAccountActive)}
                                            disabled={!isEdit}
                                            className={`relative inline-flex h-6 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${!isEdit && 'cursor-default opacity-80'} ${isAccountActive ? 'bg-[#1277E1]' : 'bg-slate-200'
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
                        </div>

                    </div>

                    {/* Right Column - Role Assignment */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-[10px] font-extrabold text-[#1277E1] bg-blue-50 px-2 py-0.5 rounded uppercase tracking-widest">ACCESS</span>
                            <h3 className="text-[13px] font-extrabold text-[#0f172a]">ROLE ASSIGNMENT</h3>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {roleOptions.map((role) => {
                                const isSelected = selectedRole === role;
                                // Hide unselected roles in View mode to clean up the UI
                                if (!isEdit && !isSelected) return null;

                                return (
                                    <div
                                        key={role}
                                        onClick={() => handleRoleChange(role)}
                                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isSelected
                                            ? (isEdit ? "bg-[#f8fafc] border-[#1277E1] shadow-[0_0_0_1px_rgba(18,119,225,1)] cursor-pointer" : "bg-[#eff6ff] border-[#bfdbfe] cursor-default")
                                            : "bg-white border-[#e2e8f0] hover:bg-[#f8fafc] hover:border-[#cbd5e1] cursor-pointer"
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isSelected ? "bg-[#1277E1]" : "bg-white border-2 border-[#cbd5e1]"
                                            } ${!isEdit && !isSelected ? 'hidden' : ''}`}>
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
                        {isEdit ? 'Cancel' : 'Close'}
                    </button>
                    {isEdit && (
                        <button
                            onClick={handleSave}
                            className="flex items-center justify-center gap-2 bg-[#1277E1] hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-sm active:scale-95 text-[14px]"
                        >
                            <span className="material-icons text-[18px]">save_as</span>
                            Save Changes
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
