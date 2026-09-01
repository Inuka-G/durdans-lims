"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { BranchUser, getSuperadminRoles, resetBranchUserPassword } from "@/lib/api";

interface ViewEditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'view' | 'edit' | 'reset';
    userData: BranchUser | null;
    onSave?: (updatedData: Partial<BranchUser>) => void;
}

export default function ViewEditUserModal({ isOpen, onClose, mode, userData, onSave }: ViewEditUserModalProps) {
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
    
    // Reset Password States
    const [isResetPasswordMode, setIsResetPasswordMode] = useState(false);
    const [resetPasswords, setResetPasswords] = useState({
        newPassword: "",
        adminPassword: "",
    });
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        if (userData && isOpen) {
            setIsAccountActive(userData.isActive);
            setSelectedRole(userData.role || "");
            setFormData({
                firstName: userData.firstName || "",
                lastName: userData.lastName || "",
                email: userData.email || "",
                phone: userData.phone || "",
                username: userData.username || userData.email.split('@')[0],
            });
            
            if (mode === 'reset') {
                setIsResetPasswordMode(true);
                setResetPasswords({ newPassword: "admin", adminPassword: "admin" });
            } else {
                setIsResetPasswordMode(false);
                setResetPasswords({ newPassword: "", adminPassword: "" });
            }
            
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
    }, [userData, isOpen]);

    if (!isOpen || !userData) return null;

    const isEdit = mode === 'edit' || mode === 'reset';

    const handleRoleChange = (role: string) => {
        if (!isEdit) return;
        setSelectedRole(role);
    };

    const handleSave = () => {
        if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !selectedRole) {
            toast.error("Please fill in all required fields (First Name, Last Name, Email, and Role)");
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

    const handleResetPassword = async () => {
        if (!resetPasswords.newPassword || !resetPasswords.adminPassword) {
            toast.error("Both your admin password and the new password are required");
            return;
        }

        setIsResetting(true);
        try {
            await resetBranchUserPassword(
                userData.id,
                resetPasswords.newPassword,
                resetPasswords.adminPassword
            );
            toast.success("Password reset successfully");
            setIsResetPasswordMode(false);
            setResetPasswords({ newPassword: "", adminPassword: "" });
        } catch (error: any) {
            console.error("Failed to reset password", error);
            const msg = error.response?.data?.message || "Failed to reset password";
            toast.error(msg);
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">

            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[900px] flex flex-col max-h-[90vh] overflow-hidden font-sans animation-scale-up">

                {/* Header */}
                <div className="p-6 border-b border-[#ecf0f6] flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isResetPasswordMode ? 'bg-red-50 text-red-500' : isEdit ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-[#1277E1]'}`}>
                            <span className="material-icons text-[24px]">{isResetPasswordMode ? 'lock_reset' : isEdit ? 'edit' : 'visibility'}</span>
                        </div>
                        <div>
                            <h2 className="text-[20px] font-extrabold text-[#0f172a] tracking-tight">
                                {isResetPasswordMode ? 'Reset User Password' : isEdit ? 'Edit User Details' : 'User Profile Details'}
                            </h2>
                            <p className="text-[13px] font-medium text-[#64748b]">
                                {isResetPasswordMode ? `Setting new password for ${userData.email}` : isEdit ? `Modifying settings for ${userData.id || userData.email}` : `Viewing information for ${userData.id || userData.email}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            if (isResetPasswordMode) {
                                setIsResetPasswordMode(false);
                                setResetPasswords({ newPassword: "", adminPassword: "" });
                            } else {
                                onClose();
                            }
                        }}
                        className="text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#f8fafc] p-2 rounded-xl transition-colors"
                    >
                        <span className="material-icons text-[24px]">{isResetPasswordMode ? 'arrow_back' : 'close'}</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className={`flex-1 overflow-y-auto p-8 bg-white grid gap-12 ${isResetPasswordMode ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>

                    {isResetPasswordMode ? (
                        <div className="max-w-md mx-auto w-full space-y-6">
                            <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl flex gap-3 text-sm">
                                <span className="material-icons text-orange-500">warning</span>
                                <p>You are about to force a password reset for <b>{userData.email}</b>. For security reasons, you must enter your own admin password to confirm this action.</p>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">New Password for User</label>
                                    <input
                                        type="password"
                                        value={resetPasswords.newPassword}
                                        onChange={(e) => setResetPasswords({ ...resetPasswords, newPassword: e.target.value })}
                                        placeholder="Enter new password"
                                        className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all text-[14px]"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">Your Admin Password</label>
                                    <input
                                        type="password"
                                        value={resetPasswords.adminPassword}
                                        onChange={(e) => setResetPasswords({ ...resetPasswords, adminPassword: e.target.value })}
                                        placeholder="Enter your password to confirm"
                                        className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all text-[14px]"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Left Column - Basic Information */}
                            <div>
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="text-[10px] font-extrabold text-[#1277E1] bg-blue-50 px-2 py-0.5 rounded uppercase tracking-widest">INFO</span>
                                    <h3 className="text-[13px] font-extrabold text-[#0f172a]">BASIC INFORMATION</h3>
                                </div>

                                <div className="space-y-5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">FIRST NAME</label>
                                            <input
                                                type="text"
                                                value={formData.firstName}
                                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                                readOnly={!isEdit}
                                                className={`w-full border text-[#0f172a] font-bold py-3 px-4 rounded-xl focus:outline-none transition-all text-[14px] ${isEdit
                                                    ? "bg-white border-[#e2e8f0] focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1]"
                                                    : "bg-[#f8fafc] border-transparent cursor-default"
                                                    }`}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-extrabold text-[#64748b] uppercase tracking-widest block mb-2">LAST NAME</label>
                                            <input
                                                type="text"
                                                value={formData.lastName}
                                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
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
                        </>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-[#ecf0f6] bg-[#f8fafc] flex justify-between items-center gap-4 relative z-10">
                    {/* Left Actions (Reset Password button) */}
                    <div>
                        {isEdit && !isResetPasswordMode && (
                            <button
                                onClick={() => setIsResetPasswordMode(true)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold px-4 py-2.5 rounded-xl transition-colors text-[14px] flex items-center gap-2"
                            >
                                <span className="material-icons text-[18px]">lock_reset</span>
                                Reset Password
                            </button>
                        )}
                    </div>

                    {/* Right Actions (Cancel, Save) */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => {
                                if (isResetPasswordMode) {
                                    setIsResetPasswordMode(false);
                                    setResetPasswords({ newPassword: "", adminPassword: "" });
                                } else {
                                    onClose();
                                }
                            }}
                            className="text-[#64748b] hover:text-[#0f172a] font-bold px-6 py-2.5 rounded-xl transition-colors text-[14px]"
                        >
                            {isEdit || isResetPasswordMode ? 'Cancel' : 'Close'}
                        </button>
                        
                        {isResetPasswordMode ? (
                            <button
                                onClick={handleResetPassword}
                                disabled={isResetting}
                                className={`flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-sm active:scale-95 text-[14px] ${isResetting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                <span className="material-icons text-[18px]">{isResetting ? 'hourglass_empty' : 'warning'}</span>
                                {isResetting ? 'Resetting...' : 'Force Reset Password'}
                            </button>
                        ) : isEdit && (
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
        </div>
    );
}
