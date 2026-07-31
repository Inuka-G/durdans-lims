"use client";

import Link from "next/link";

interface BranchDetailsPanelProps {
    onClose: () => void;
    onEditClick?: () => void;
    onChangeAdminClick?: () => void;
}

export default function BranchDetailsPanel({ onClose, onEditClick, onChangeAdminClick }: BranchDetailsPanelProps) {
    return (
        <div className="h-full flex flex-col bg-white overflow-hidden font-sans text-slate-900">

            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-slate-100">
                <div>
                    <h2 className="text-xl font-extrabold text-[#1a2b4b] tracking-tight">Branch Details</h2>
                    <p className="text-[13px] font-medium text-slate-500 mt-1">Monitoring and Administrative Controls</p>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg"
                >
                    <span className="material-icons text-xl block">close</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">

                {/* Health Score Widget */}
                <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-5 mb-8 flex items-center gap-5">
                    {/* Circular Chart Representation */}
                    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                                className="text-slate-200"
                                strokeWidth="4"
                                stroke="currentColor"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                                className="text-[#1277E1]"
                                strokeWidth="4"
                                strokeDasharray="92, 100"
                                stroke="currentColor"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center">
                            <span className="text-xl font-extrabold text-[#1277E1] leading-none">92%</span>
                            <span className="text-[8px] font-bold text-slate-400 mt-0.5 tracking-wider uppercase">Health</span>
                        </div>
                    </div>

                    <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Branch Health Score</span>
                        <h3 className="text-base font-bold text-[#1a2b4b]">Excellent Performance</h3>
                        <p className="text-xs font-medium text-slate-500 mt-1.5 leading-relaxed pr-2">
                            Based on server uptime, patient throughput, and staff activity logs.
                        </p>
                    </div>
                </div>

                {/* Branch Information Section */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-icons text-blue-500 text-[20px]">info</span>
                        <h3 className="text-[15px] font-extrabold text-[#1a2b4b]">Branch Information</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="border border-slate-100 rounded-2xl p-4 bg-white shadow-sm">
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Branch ID</span>
                            <span className="text-[13px] font-extrabold text-slate-800">BR-COL-001</span>
                        </div>
                        <div className="border border-slate-100 rounded-2xl p-4 bg-white shadow-sm">
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Established</span>
                            <span className="text-[13px] font-extrabold text-slate-800">Jan 12, 2018</span>
                        </div>
                    </div>

                    <div className="border border-slate-100 rounded-2xl p-4 bg-white shadow-sm">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Legal Entity Name</span>
                        <span className="text-[13px] font-extrabold text-slate-800">Colombo Main General Hospital Laboratory Services</span>
                    </div>
                </div>

                {/* Contact Details Section */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-icons text-blue-500 text-[20px]">contact_page</span>
                        <h3 className="text-[15px] font-extrabold text-[#1a2b4b]">Contact Details</h3>
                    </div>

                    <div className="space-y-4 px-1">
                        <div className="flex items-start gap-4">
                            <span className="material-icons text-slate-400 text-[18px] mt-0.5">location_on</span>
                            <span className="text-[13.5px] font-medium text-slate-600 leading-snug">No. 420, Bauddhaloka Mawatha, Colombo 07, Sri Lanka</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="material-icons text-slate-400 text-[18px]">phone</span>
                            <span className="text-[13.5px] font-medium text-slate-600">+94 11 2345 678</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="material-icons text-slate-400 text-[18px]">email</span>
                            <span className="text-[13.5px] font-medium text-slate-600">colombo.main@laborp.com</span>
                        </div>
                    </div>
                </div>

                {/* Assigned Branch Admin Section */}
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-icons text-blue-500 text-[20px]">admin_panel_settings</span>
                        <h3 className="text-[15px] font-extrabold text-[#1a2b4b]">Assigned Branch Admin</h3>
                    </div>

                    <div className="border border-slate-100 rounded-2xl p-4 bg-white shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-slate-200">
                                <span className="material-icons text-orange-400 text-sm">person</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[13px] font-extrabold text-slate-800">Arjuna Kariyawasam</span>
                                <span className="text-[11px] font-medium text-slate-500">arjuna.k@durdans.com</span>
                            </div>
                        </div>
                        <button onClick={onChangeAdminClick} className="text-blue-600 text-xs font-bold hover:underline">Change</button>
                    </div>
                </div>

            </div>

            {/* Sticky Actions Footer */}
            <div className="p-5 border-t border-slate-100 bg-white grid grid-cols-[1fr_auto] gap-3 relative z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                <button
                    onClick={onEditClick}
                    className="flex items-center justify-center gap-2 bg-[#1277E1] hover:bg-blue-600 text-white py-3.5 rounded-2xl font-bold transition-colors shadow-sm active:scale-[0.98]"
                >
                    <span className="material-icons text-[18px]">edit</span>
                    EDIT BRANCH
                </button>
                <Link
                    href="/superadmin/admin/audit"
                    className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold px-6 py-3.5 rounded-2xl transition-colors border border-slate-200 block text-center min-w-[140px] shadow-sm flex items-center justify-center"
                >
                    AUDIT LOG
                </Link>
            </div>

        </div>
    );
}
