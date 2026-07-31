"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function AdministrationNavbar() {
    const pathname = usePathname();

    let pageTitle = "Administration Panel";
    if (pathname.includes("/users")) pageTitle = "Global User Control";
    if (pathname.includes("/roles")) pageTitle = "Role Definitions";
    if (pathname.includes("/branches")) pageTitle = "Branch Management";
    if (pathname.includes("/audit")) pageTitle = "Audit Trails";
    if (pathname.includes("/security")) pageTitle = "Security Settings";

    return (
        <header className="fixed top-0 left-64 right-0 h-[72px] bg-white border-b border-slate-200 z-50">
            <div className="flex items-center justify-between h-full px-8">
                {/* Page Title Area */}
                <div className="flex-1 flex flex-col justify-center h-full">
                    <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">{pageTitle}</h1>
                </div>

                <div className="flex items-center gap-6">
                    {/* Security Shield */}
                    <div className="relative cursor-pointer hover:bg-slate-50 p-2 rounded-full transition-colors">
                        <span className="material-icons text-slate-400 text-[22px]">security</span>
                        <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white"></div>
                    </div>

                    {/* Profile */}
                    <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                        <div className="text-right">
                            <p className="text-sm font-bold text-slate-800 leading-tight">Super Admin</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Corporate Headquarters</p>
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
