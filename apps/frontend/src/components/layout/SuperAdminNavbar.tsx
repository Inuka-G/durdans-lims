"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

export default function SuperAdminNavbar() {
    const pathname = usePathname();
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState("All Branches");

    const branches = ["All Branches", "Colombo Branch", "Kandy Regional Center", "Galle Southern Hub"];

    const isMonitoring = pathname === "/superadmin/monitoring";

    const title = isMonitoring ? "System Monitoring" : "Super Admin – Global Dashboard";
    const subTitle = isMonitoring ? "Live Infrastructure Status" : null;

    return (
        <header className="fixed top-0 left-64 right-0 h-[72px] bg-white border-b border-slate-200 z-50">
            <div className="flex items-center justify-between h-full px-8">
                <div>
                    <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        {title}
                    </h1>
                    {subTitle && (
                        <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="material-icons text-emerald-500 text-[14px]">sensors</span>
                            {subTitle}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-6">
                    {/* Branch or Env Selector */}
                    {isMonitoring ? (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Environment:</span>
                            <span className="text-xs font-bold text-slate-800 pr-1">Production Cluster-01</span>
                        </div>
                    ) : (
                        <div className="relative">
                            <button
                                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                                className="flex items-center gap-2 bg-slate-100/80 hover:bg-slate-200/60 transition-colors px-4 py-2 rounded-full cursor-pointer border border-slate-200/50 focus:outline-none"
                            >
                                <span className="material-icons text-slate-400 text-sm">location_on</span>
                                <span className="text-sm font-bold text-slate-700">{selectedBranch}</span>
                                <span className="material-icons text-slate-500 text-sm">expand_more</span>
                            </button>

                            {isBranchDropdownOpen && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 py-1 z-50">
                                    {branches.map((branch) => (
                                        <button
                                            key={branch}
                                            onClick={() => {
                                                setSelectedBranch(branch);
                                                setIsBranchDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-slate-50 ${selectedBranch === branch ? "text-blue-600 bg-blue-50/50" : "text-slate-600"
                                                }`}
                                        >
                                            {branch}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notifications */}
                    <div className="relative cursor-pointer hover:bg-slate-50 p-2 rounded-full transition-colors">
                        <span className="material-icons text-slate-400 text-[22px]">notifications_none</span>
                        <div className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></div>
                    </div>

                    {/* Profile */}
                    <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                        <div className="text-right">
                            <p className="text-sm font-bold text-slate-800 leading-tight">Admin User</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Global Controller</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-slate-200">
                            <span className="material-icons text-orange-400 text-sm">person</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
