"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// --- Sidebar nav items with colored icon badges ---
const menuItems = [
    { name: "Global Dashboard", icon: "window", href: "/superadmin" },
    { name: "Branch Management", icon: "account_tree", href: "/superadmin/admin/branches" },
    { name: "User & Role Control", icon: "manage_accounts", href: "/superadmin/users" },
    { name: "Master Data", icon: "source", href: "/superadmin/master-data" },
    { name: "System Monitoring", icon: "query_stats", href: "/superadmin/monitoring" },
    { name: "Cross-Branch Reports", icon: "insert_chart_outlined", href: "/superadmin/reports" },
];





export default function Sidebar() {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (pathname === href) return true;
        if (href !== "/superadmin" && pathname.startsWith(href)) return true;
        return false;
    };

    return (
        <aside className="w-64 bg-white border-r border-slate-200 fixed inset-y-0 left-0 hidden lg:flex flex-col z-50">
            {/* Header / Logo Area */}
            <div className="h-[72px] flex items-center gap-3 px-6 border-b border-slate-100">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shadow-blue-600/20">
                    <span className="material-icons text-[20px]">science</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[15px] font-extrabold tracking-tight text-slate-900 leading-tight">
                        LABORATORY <span className="text-blue-600">ERP</span>
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight mt-0.5">
                        Super Admin Panel
                    </span>
                </div>
            </div>

            <div className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar flex flex-col">
                <nav className="space-y-1">
                    {menuItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${active
                                    ? "bg-blue-50 text-blue-600 font-bold"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                    }`}
                            >
                                <span className={`material-icons text-[20px] transition-colors ${active ? "text-blue-500" : "text-slate-400 group-hover:text-slate-600"
                                    }`}>
                                    {item.icon}
                                </span>
                                <span className="text-[13px]">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-8 px-2">
                    <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">
                        Node Health
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-1.5">
                                <span className="text-slate-600">Main API Node</span>
                                <span className="text-emerald-500">Stable</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '90%' }}></div>
                            </div>
                        </div>

                    </div>
                </div>

                <div className="mt-8 pt-8 pb-2 border-t border-slate-100">
                    <nav className="space-y-1">
                        <Link
                            href="/superadmin/security"
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${isActive("/superadmin/security")
                                ? "bg-blue-50 text-blue-600 font-bold"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                                }`}
                        >
                            <span className={`material-icons text-[20px] transition-colors ${isActive("/superadmin/security") ? "text-blue-500" : "text-slate-400 group-hover:text-slate-600"
                                }`}>
                                security
                            </span>
                            <span className="text-[13px]">Security</span>
                        </Link>
                    </nav>
                </div>
            </div>
        </aside>
    );
}
