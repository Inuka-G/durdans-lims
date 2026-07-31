"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
    { name: "Dashboard", icon: "grid_view", href: "/branch" },
    { name: "User Management", icon: "people", href: "/branch/users" },
    { name: "Branch Reports", icon: "insert_chart", href: "/branch/reports" },
    { name: "Activity Logs", icon: "history", href: "/branch/activity-logs" },
];

export default function BranchSidebar() {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === "/branch" && pathname === "/branch") return true;
        if (href !== "/branch" && pathname.startsWith(href)) return true;
        return false;
    };

    return (
        <aside className="w-[260px] bg-white border-r border-[#ecf0f6] fixed inset-y-0 left-0 hidden lg:flex flex-col z-50">
            {/* Header / Logo Area */}
            <div className="h-[76px] flex items-center gap-3 px-6 border-b border-[#ecf0f6] bg-white">
                <div className="w-8 h-8 bg-[#1277E1] rounded-[8px] flex items-center justify-center text-white shadow-sm">
                    <span className="material-icons text-[18px]">add</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[17px] font-extrabold tracking-tight text-[#0f172a] leading-tight">
                        DURDANS <span className="text-[#1277E1] font-bold">ERP</span>
                    </span>
                </div>
            </div>

            <div className="flex-1 py-8 overflow-y-auto custom-scrollbar flex flex-col px-4">
                <nav className="space-y-1.5 pt-2">
                    {menuItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3.5 px-4 py-3 rounded-[12px] transition-all duration-200 group relative ${active
                                    ? "bg-[#1277E1] text-white font-bold shadow-sm"
                                    : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] font-semibold"
                                    }`}
                            >
                                <span className={`material-icons text-[20px] transition-colors ${active ? "text-white" : "text-[#94a3b8] group-hover:text-[#64748b]"
                                    }`}>
                                    {item.icon}
                                </span>
                                <span className="text-[14px] leading-tight flex-1">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

            </div>
        </aside>
    );
}
