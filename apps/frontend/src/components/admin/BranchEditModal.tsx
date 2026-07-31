import { useState, useEffect } from "react";

interface BranchEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchData?: {
        id: string;
        name: string;
        location: string;
        status: string;
    } | null;
}

export default function BranchEditModal({ isOpen, onClose, branchData }: BranchEditModalProps) {
    const [formData, setFormData] = useState({
        branchName: "",
        location: "",
        contactEmail: "",
        contactPhone: "",
        status: "Active"
    });

    useEffect(() => {
        if (branchData) {
            setFormData({
                branchName: branchData.name,
                location: branchData.location,
                contactEmail: "colombo.main@laborp.com", // mocked default
                contactPhone: "+94 11 2345 678", // mocked default
                status: branchData.status
            });
        }
    }, [branchData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Here you would typically handle the API submission
        console.log("Submitting branch updates:", formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-[500px] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1277E1] flex items-center justify-center">
                            <span className="material-icons text-[18px]">edit_note</span>
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Edit Branch Details</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                        <span className="material-icons text-[20px]">close</span>
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Branch Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Colombo Main Branch"
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all placeholder:text-slate-400"
                            value={formData.branchName}
                            onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Location (City/Area) <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Colombo 07"
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all placeholder:text-slate-400"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Contact Email</label>
                            <input
                                type="email"
                                placeholder="colombo@hospital.com"
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all placeholder:text-slate-400"
                                value={formData.contactEmail}
                                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Contact Phone</label>
                            <input
                                type="tel"
                                placeholder="+94 XX XXX XXXX"
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all placeholder:text-slate-400"
                                value={formData.contactPhone}
                                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Status</label>
                        <div className="relative">
                            <select
                                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold py-2.5 pl-3 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all cursor-pointer"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="Active">Active / Operational</option>
                                <option value="In Setup">In Setup Phase</option>
                                <option value="Maintainance">Under Maintenance</option>
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2.5 rounded-xl font-bold bg-[#1277E1] hover:bg-blue-600 text-white transition-colors shadow-sm text-sm"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
