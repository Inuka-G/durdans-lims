"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const accessManagementItems = [
    { name: "Global User Control", icon: "manage_accounts", href: "/superadmin/users" },
    { name: "Role Definitions", icon: "admin_panel_settings", href: "/superadmin/roles" },
    { name: "Branch Management", icon: "domain_add", href: "/superadmin/admin/branches" },
    { name: "Audit Trails", icon: "history", href: "/superadmin/admin/audit" },
];

const securityPolicyItems = [
    { name: "Security", icon: "security", href: "/superadmin/security" },
];

export default function AdministrationSidebar() {
    const pathname = usePathname();

    const isActive = (href: string) => {
        return pathname.startsWith(href);
    };

    return (
        <aside className="w-64 bg-slate-50 border-r border-slate-200 fixed inset-y-0 left-0 hidden lg:flex flex-col z-50">
            {/* Header / Logo Area */}
            <div className="h-[72px] flex items-center gap-3 px-6 border-b border-slate-200 bg-white">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shadow-blue-600/20">
                    <span className="material-icons text-[20px]">science</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[17px] font-extrabold tracking-tight text-slate-900 leading-tight">
                        DURDANS <span className="text-blue-600 font-bold">ERP</span>
                    </span>
                </div>
            </div>

            <div className="flex-1 py-6 overflow-y-auto custom-scrollbar flex flex-col">

                {/* Access Management Section */}
                <div className="mb-8">
                    <h3 className="px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">
                        Access Management
                    </h3>
                    <nav className="space-y-1 px-4">
                        {accessManagementItems.map((item) => {
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${active
                                        ? "bg-blue-50 text-blue-600 font-bold shadow-sm border border-blue-100"
                                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 font-semibold"
                                        }`}
                                >
                                    <span className={`material-icons text-[20px] transition-colors ${active ? "text-blue-500" : "text-slate-400 group-hover:text-slate-600"
                                        }`}>
                                        {item.icon}
                                    </span>
                                    <span className="text-[13px] leading-tight flex-1">{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Security Policies Section */}
                <div>
                    <h3 className="px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">
                        Security Policies
                    </h3>
                    <nav className="space-y-1 px-4">
                        {securityPolicyItems.map((item) => {
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${active
                                        ? "bg-blue-50 text-blue-600 font-bold shadow-sm border border-blue-100"
                                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 font-semibold"
                                        }`}
                                >
                                    <span className={`material-icons text-[20px] transition-colors ${active ? "text-blue-500" : "text-slate-400 group-hover:text-slate-600"
                                        }`}>
                                        {item.icon}
                                    </span>
                                    <span className="text-[13px] leading-tight flex-1">{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>
        </aside>
    );
}
