"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState } from "react";

export default function BranchNavbar() {
    const pathname = usePathname();
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState("Colombo Branch");

    const branches = ["Colombo Branch", "Kandy Regional Center", "Galle Southern Hub"];

    // Deriving title based on sub-routes loosely
    let pageTitle = "Branch Admin Dashboard";
    if (pathname.includes("/users")) pageTitle = "User Management";
    if (pathname.includes("/reports")) pageTitle = "Branch Reports";

    return (
        <header className="fixed top-0 left-[260px] right-0 h-[76px] bg-white border-b border-[#ecf0f6] z-50">
            <div className="flex items-center justify-between h-full px-8">

                {/* Dynamic Title Area */}
                <div className="flex flex-col justify-center h-full">
                    <h1 className="text-[16px] font-extrabold text-[#0f172a] tracking-tight">{pageTitle}</h1>
                    <div className="relative mt-0.5">
                        <button
                            onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                            className="flex items-center gap-1.5 text-[#64748b] hover:text-[#0f172a] transition-colors focus:outline-none"
                        >
                            <span className="material-icons text-[14px] text-[#1277E1]">location_on</span>
                            <span className="text-[12px] font-semibold">{selectedBranch}</span>
                            <span className="material-icons text-[14px]">expand_more</span>
                        </button>

                        {isBranchDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 py-1 z-50">
                                {branches.map((branch) => (
                                    <button
                                        key={branch}
                                        onClick={() => {
                                            setSelectedBranch(branch);
                                            setIsBranchDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 text-[12px] font-semibold transition-colors hover:bg-slate-50 ${selectedBranch === branch ? "text-blue-600 bg-blue-50/50" : "text-slate-600"
                                            }`}
                                    >
                                        {branch}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Search */}
                    <div className="relative hidden md:block">
                        <span className="material-icons absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-[18px]">search</span>
                        <input
                            type="text"
                            placeholder="Search data, reports..."
                            className="w-[280px] bg-[#f8fafc] border border-[#ecf0f6] text-[13px] rounded-full py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all placeholder:text-[#94a3b8] font-medium text-[#475569]"
                        />
                    </div>

                    {/* Notifications */}
                    <div className="relative cursor-pointer hover:bg-[#f1f5f9] p-2 rounded-full transition-colors">
                        <span className="material-icons text-[#94a3b8] text-[22px]">notifications</span>
                        <div className="absolute top-2 right-2.5 w-2 h-2 bg-[#ef4444] rounded-full border-2 border-white"></div>
                    </div>

                    {/* Profile Block */}
                    <div className="flex items-center gap-3.5 pl-4 border-l border-[#ecf0f6]">
                        <div className="text-right hidden sm:block">
                            <p className="text-[14px] font-extrabold text-[#0f172a] leading-tight tracking-tight">Admin</p>
                            <p className="text-[9px] font-extrabold text-[#64748b] uppercase tracking-wider mt-0.5">SENIOR BRANCH MANAGER</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-[#ffedd5] flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-[#e2e8f0]">
                            <span className="material-icons text-[#fb923c] text-[20px]">person</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
