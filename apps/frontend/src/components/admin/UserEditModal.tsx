import { useState, useEffect } from "react";

interface UserRecord {
    id: string;
    name: string;
    email: string;
    branch: string;
    roles: string[];
    status: "ACTIVE" | "INACTIVE";
    lastLogin: string;
}

interface UserEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: UserRecord | null;
}

export default function UserEditModal({ isOpen, onClose, userData }: UserEditModalProps) {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        branch: "Colombo",
        role: "Branch Admin",
        status: "ACTIVE"
    });

    useEffect(() => {
        if (userData) {
            setFormData({
                name: userData.name,
                email: userData.email,
                branch: userData.branch,
                role: userData.roles[0] || "Consultant",
                status: userData.status
            });
        }
    }, [userData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Saving user changes:", formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] overflow-hidden flex flex-col font-sans transform transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/50">
                            <span className="material-icons text-[22px]">manage_accounts</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight">Edit User Profile</h2>
                            <p className="text-[12px] font-medium text-slate-500 mt-0.5">Modify identity parameters and access levels</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200/50"
                    >
                        <span className="material-icons text-[20px] block">close</span>
                    </button>
                </div>

                {/* Form Body */}
                <div className="overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar">
                    <form id="edit-user-form" onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Full Name</label>
                            <div className="relative">
                                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">badge</span>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-white border border-slate-200 text-slate-800 text-[14px] font-semibold py-2.5 pl-10 pr-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Email Address</label>
                            <div className="relative">
                                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">email</span>
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-white border border-slate-200 text-slate-800 text-[14px] font-semibold py-2.5 pl-10 pr-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Branch</label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none bg-white border border-slate-200 text-slate-800 text-[14px] font-semibold py-2.5 pl-3.5 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-sm"
                                        value={formData.branch}
                                        onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                                    >
                                        <option value="Colombo">Colombo</option>
                                        <option value="Kandy">Kandy</option>
                                        <option value="Galle">Galle</option>
                                    </select>
                                    <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Role</label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none bg-white border border-slate-200 text-slate-800 text-[14px] font-semibold py-2.5 pl-3.5 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-sm"
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="Consultant">Consultant</option>
                                        <option value="Branch Admin">Branch Admin</option>
                                        <option value="Nursing Head">Nursing Head</option>
                                        <option value="Doctor">Doctor</option>
                                        <option value="Dept Head">Dept Head</option>
                                    </select>
                                    <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-white hover:bg-slate-50 text-slate-700 font-bold px-5 py-2.5 rounded-xl border border-slate-200 transition-colors shadow-sm text-[13px]"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="edit-user-form"
                        className="flex items-center gap-2 bg-[#1277E1] hover:bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl transition-colors shadow-sm text-[13px]"
                    >
                        Save Changes
                        <span className="material-icons text-[16px] -mr-1">done</span>
                    </button>
                </div>

            </div>
        </div>
    );
}
