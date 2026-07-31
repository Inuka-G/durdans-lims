"use client";

import { useState } from "react";

export default function DetailedRolePermissionsPage() {
    const [isMLTModuleExpanded, setIsMLTModuleExpanded] = useState(true);

    return (
        <div className="max-w-[1400px] mx-auto w-full font-sans text-slate-900 min-h-[calc(100vh-136px)] pt-2 pb-24 flex flex-col relative">

            <div className="mb-8 flex flex-col xl:flex-row xl:items-start justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#94a3b8] mb-3">
                        <span className="hover:text-[#0f172a] cursor-pointer transition-colors">System Admin</span>
                        <span className="text-[10px] opacity-50">/</span>
                        <span className="hover:text-[#0f172a] cursor-pointer transition-colors">Role Permissions</span>
                        <span className="text-[10px] opacity-50">/</span>
                        <span className="text-[#0f172a] font-bold">Medical Laboratory Technologist</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-extrabold text-[#0f172a] tracking-tight">Medical Laboratory Technologist (MLT)</h1>
                        <span className="bg-[#eff6ff] text-[#1277E1] text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-widest border border-[#bfdbfe]">CORE ROLE</span>
                    </div>
                    <p className="text-[14px] font-medium text-[#64748b] mt-2">Configure granular module-specific access for MLT staff members.</p>
                </div>

                {/* Search Input */}
                <div className="relative w-full xl:w-[380px]">
                    <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8] text-[20px]">search</span>
                    <input
                        type="text"
                        placeholder="Search permissions in this role..."
                        className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] font-bold py-3.5 pl-12 pr-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all placeholder:text-[#94a3b8] placeholder:font-medium text-[14px] shadow-sm"
                    />
                </div>
            </div>

            <div className="space-y-4">

                {/* Accordion 1 - MLT Processing Module (Expanded) */}
                <div className="bg-white border border-[#1277E1]/20 shadow-[0_4px_20px_-10px_rgba(18,119,225,0.15)] rounded-2xl overflow-hidden transition-all">
                    {/* Accordion Header */}
                    <div
                        className="p-6 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between cursor-pointer group"
                        onClick={() => setIsMLTModuleExpanded(!isMLTModuleExpanded)}
                    >
                        <div className="flex items-center gap-4">
                            <span className="material-icons text-[#1277E1] text-[24px]">science</span>
                            <h2 className="text-[18px] font-extrabold text-[#0f172a] tracking-tight group-hover:text-[#1277E1] transition-colors">MLT Processing Module</h2>
                            <span className="bg-[#e2e8f0] text-[#475569] text-[11px] font-extrabold px-3 py-1 rounded-full">8 Permissions</span>
                        </div>
                        <span className="material-icons text-[#94a3b8] transition-transform duration-200" style={{ transform: isMLTModuleExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                    </div>

                    {/* Accordion Body */}
                    {isMLTModuleExpanded && (
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">

                            {/* Checkbox Item 1 */}
                            <div className="flex items-start gap-4 p-2 -m-2 rounded-xl hover:bg-[#f8fafc] transition-colors">
                                <div className="mt-0.5 flex items-center justify-center w-5 h-5 bg-[#1277E1] rounded-[4px] shadow-sm text-white shrink-0">
                                    <span className="material-icons text-[16px]">check</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-[15px] font-bold text-[#0f172a]">Specimen Acknowledgment</h3>
                                        <span className="material-icons text-[#cbd5e1] text-[16px]" title="Required for core role function">lock</span>
                                    </div>
                                    <p className="text-[13px] font-medium text-[#64748b] mt-1 leading-relaxed">
                                        Ability to confirm receipt of samples from phlebotomy or wards.
                                    </p>
                                </div>
                            </div>

                            {/* Checkbox Item 2 */}
                            <div className="flex items-start gap-4 p-2 -m-2 rounded-xl hover:bg-[#f8fafc] transition-colors">
                                <div className="mt-0.5 flex items-center justify-center w-5 h-5 bg-[#1277E1] rounded-[4px] shadow-sm text-white shrink-0">
                                    <span className="material-icons text-[16px]">check</span>
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-bold text-[#0f172a]">Enter Test Results</h3>
                                    <p className="text-[13px] font-medium text-[#64748b] mt-1 leading-relaxed">
                                        Manual entry and batch upload of analyzer results to the system.
                                    </p>
                                </div>
                            </div>

                            {/* Checkbox Item 3 */}
                            <div className="flex items-start gap-4 p-2 -m-2 rounded-xl hover:bg-[#f8fafc] transition-colors">
                                <div className="mt-0.5 flex items-center justify-center w-5 h-5 bg-[#1277E1] rounded-[4px] shadow-sm text-white shrink-0">
                                    <span className="material-icons text-[16px]">check</span>
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-bold text-[#0f172a]">Edit Result History</h3>
                                    <p className="text-[13px] font-medium text-[#64748b] mt-1 leading-relaxed">
                                        Modify existing result entries before final verification is locked.
                                    </p>
                                </div>
                            </div>

                            {/* Checkbox Item 4 */}
                            <div className="flex items-start gap-4 p-2 -m-2 rounded-xl hover:bg-[#f8fafc] transition-colors">
                                <div className="mt-0.5 flex items-center justify-center w-5 h-5 bg-white border-2 border-[#cbd5e1] rounded-[4px] shrink-0">
                                    {/* Unchecked */}
                                </div>
                                <div className="opacity-70">
                                    <h3 className="text-[15px] font-bold text-[#0f172a]">Override Abnormal Flags</h3>
                                    <p className="text-[13px] font-medium text-[#64748b] mt-1 leading-relaxed">
                                        Dismiss system-generated critical value alerts during data entry.
                                    </p>
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                {/* Collapsed Accordions */}
                <div className="bg-white border border-[#e2e8f0] shadow-sm rounded-2xl overflow-hidden cursor-pointer hover:border-[#cbd5e1] transition-all">
                    <div className="p-6 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <span className="material-icons text-[#1277E1] text-[24px]">verified_user</span>
                            <h2 className="text-[18px] font-extrabold text-[#0f172a] tracking-tight group-hover:text-[#1277E1] transition-colors">Verification & Authorization</h2>
                            <span className="bg-[#f1f5f9] text-[#64748b] text-[11px] font-extrabold px-3 py-1 rounded-full border border-[#e2e8f0]">4 Permissions</span>
                        </div>
                        <span className="material-icons text-[#94a3b8]">expand_more</span>
                    </div>
                </div>

                <div className="bg-white border border-[#e2e8f0] shadow-sm rounded-2xl overflow-hidden cursor-pointer hover:border-[#cbd5e1] transition-all">
                    <div className="p-6 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <span className="material-icons text-[#1277E1] text-[24px]">settings_suggest</span>
                            <h2 className="text-[18px] font-extrabold text-[#0f172a] tracking-tight group-hover:text-[#1277E1] transition-colors">QC & Instrument Maintenance</h2>
                            <span className="bg-[#f1f5f9] text-[#64748b] text-[11px] font-extrabold px-3 py-1 rounded-full border border-[#e2e8f0]">12 Permissions</span>
                        </div>
                        <span className="material-icons text-[#94a3b8]">expand_more</span>
                    </div>
                </div>

                <div className="bg-white border border-[#e2e8f0] shadow-sm rounded-2xl overflow-hidden cursor-pointer hover:border-[#cbd5e1] transition-all">
                    <div className="p-6 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <span className="material-icons text-[#1277E1] text-[24px]">description</span>
                            <h2 className="text-[18px] font-extrabold text-[#0f172a] tracking-tight group-hover:text-[#1277E1] transition-colors">Reporting & Statistics</h2>
                            <span className="bg-[#f1f5f9] text-[#64748b] text-[11px] font-extrabold px-3 py-1 rounded-full border border-[#e2e8f0]">6 Permissions</span>
                        </div>
                        <span className="material-icons text-[#94a3b8]">expand_more</span>
                    </div>
                </div>

            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-[#e2e8f0] p-4 px-8 flex justify-between items-center z-40 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-6">
                    <span className="text-[11px] font-medium text-[#94a3b8]">© 2023 Durdans Hospital. Version 2.4.1</span>
                    <span className="w-1 h-1 rounded-full bg-[#cbd5e1]"></span>
                    <span className="text-[11px] font-medium text-[#94a3b8]">Last modified by: <span className="text-[#64748b] font-bold">Admin_User</span> on Oct 12, 11:20 AM</span>
                </div>
                <div className="flex items-center gap-3">
                    <button className="bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#0f172a] font-bold px-6 py-2.5 rounded-xl transition-colors text-[14px]">
                        Reset to Default
                    </button>
                    <button className="bg-[#1277E1] hover:bg-blue-600 text-white font-bold px-8 py-2.5 rounded-xl transition-colors shadow-sm active:scale-95 text-[14px]">
                        Save Changes
                    </button>
                </div>
            </div>

        </div>
    );
}
