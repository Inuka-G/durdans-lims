"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const verificationItems = [
    { name: "Verification Dashboard", icon: "pending_actions", href: "/verification/pending", iconColor: "text-amber-600", iconBg: "bg-amber-100" },
    { name: "Bulk Approval", icon: "checklist_rtl", href: "/verification/bulk-approval", iconColor: "text-emerald-600", iconBg: "bg-emerald-100" },
    { name: "Verification History", icon: "history", href: "/verification/history", iconColor: "text-violet-600", iconBg: "bg-violet-100" },
    { name: "Review Case", icon: "rate_review", href: "/verification/review", iconColor: "text-blue-600", iconBg: "bg-blue-100" },
    { name: "Critical Values", icon: "crisis_alert", href: "/critical-values", iconColor: "text-red-600", iconBg: "bg-red-100" },
];

export default function SeniorMLTSidebar() {
    const pathname = usePathname();
    const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

    const renderNav = (items: typeof verificationItems) =>
        items.map((item) => {
            const active = isActive(item.href);
            return (
                <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${active ? "bg-primary/8 border-l-[3px] border-primary pl-[9px]" : "border-l-[3px] border-transparent hover:bg-slate-50 hover:shadow-sm"}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${active ? "bg-primary text-white shadow-md shadow-primary/25" : `${item.iconBg} ${item.iconColor}`}`}>
                        <span className="material-icons text-lg">{item.icon}</span>
                    </div>
                    <span className={`text-[15px] transition-colors ${active ? "font-bold text-primary" : "font-semibold text-slate-600 group-hover:text-slate-900"}`}>{item.name}</span>
                </Link>
            );
        });

    return (
        <aside className="w-64 bg-white border-r border-slate-200/80 fixed h-[calc(100vh-64px)] overflow-y-auto hidden lg:flex flex-col">
            <div className="flex-1 p-5">
                <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-3 px-1">Verification</p>
                <nav className="space-y-1 mb-8">{renderNav(verificationItems)}</nav>
            </div>
            <div className="p-5 pt-0">
                <div className="rounded-2xl bg-gradient-to-br from-primary to-blue-600 p-4 text-white shadow-lg shadow-primary/20">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="material-icons text-lg opacity-90">support_agent</span>
                        <p className="text-sm font-bold">Need Help?</p>
                    </div>
                    <p className="text-[12px] text-blue-100 leading-relaxed mb-3">Reach out to our support team for assistance.</p>
                    <a href="mailto:support@durdans.com" className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
                        <span className="material-icons text-sm">chat</span>Contact Support
                    </a>
                </div>
            </div>
        </aside>
    );
}
