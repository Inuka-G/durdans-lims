import { useState } from "react";
import { createAdminUser } from "@/lib/api";

interface UserCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function UserCreateModal({ isOpen, onClose }: UserCreateModalProps) {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        branch: "Colombo",
        role: "Branch Admin",
        status: "ACTIVE"
    });
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const trimmed = formData.name.trim();
            const sp = trimmed.indexOf(" ");
            const firstName = sp === -1 ? trimmed : trimmed.slice(0, sp);
            const lastName = sp === -1 ? "" : trimmed.slice(sp + 1);
            await createAdminUser({
                username: formData.email.split("@")[0] || formData.email,
                email: formData.email,
                firstName,
                lastName,
                // Map the display role to a Keycloak realm role name.
                role: formData.role.toUpperCase().replace(/\s+/g, "_"),
                branchCode: formData.branch,
            });
            onClose();
        } catch {
            setError("Failed to create user. Ensure the Keycloak admin module is enabled and the role/branch are valid.");
        } finally {
            setSubmitting(false);
        }
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
                            <span className="material-icons text-[22px]">person_add</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight">Create New User</h2>
                            <p className="text-[12px] font-medium text-slate-500 mt-0.5">Provision a new identity for the system</p>
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
                    <form id="create-user-form" onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">

                        {error && (
                            <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] font-semibold px-4 py-3">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Full Name</label>
                            <div className="relative">
                                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">badge</span>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Dr. Jane Doe"
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
                                    placeholder="jane.d@durdans.com"
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
                                        <option value="Colombo">Colombo Base</option>
                                        <option value="Kandy">Kandy Branch</option>
                                        <option value="Galle">Galle Outpost</option>
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
                                    </select>
                                    <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-center mt-2">Initial Status</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl w-full">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, status: "ACTIVE" })}
                                    className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${formData.status === 'ACTIVE' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {formData.status === 'ACTIVE' && <span className="material-icons text-[16px]">check_circle</span>}
                                    Active
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, status: "INACTIVE" })}
                                    className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${formData.status === 'INACTIVE' ? 'bg-white text-slate-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {formData.status === 'INACTIVE' && <span className="material-icons text-[16px]">do_not_disturb_on</span>}
                                    Inactive
                                </button>
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
                        form="create-user-form"
                        disabled={submitting}
                        className="flex items-center gap-2 bg-[#1277E1] hover:bg-blue-600 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl transition-colors shadow-sm text-[13px]"
                    >
                        {submitting ? "Creating…" : "Create User"}
                        <span className="material-icons text-[16px] -mr-1">arrow_forward</span>
                    </button>
                </div>

            </div>
        </div>
    );
}
