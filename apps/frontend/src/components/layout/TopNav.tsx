"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";
import { NavItem } from "@/lib/api";
import { useMetadata } from "@/providers/MetadataProvider";
import { usePathname } from "next/navigation";

const NAV_ORDER: Record<string, number> = {
    "/dashboard": 10,
    "/orders-billing": 20,
    "/phlebotomy": 30,
    "/lab-reception": 40,
    "/lab-testing": 50,
    "/lab-supervision": 60,
    "/pathology": 70,
    "/report-dispatch": 80,
};

const sortNavItems = (items: NavItem[]) =>
    [...items].sort((a, b) => {
        const aOrder = NAV_ORDER[a.linkUrl] ?? Number.MAX_SAFE_INTEGER;
        const bOrder = NAV_ORDER[b.linkUrl] ?? Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }

        return 0;
    });

export default function TopNav() {
    const { logout, user } = useAuth();
    const pathname = usePathname();
    const { metadata, error } = useMetadata();

    // Use fallback values if token parsing fails
    const userName = user?.name || user?.preferred_username || "User";

    // Map backend linkUrls → correct frontend routes
    const URL_MAP: Record<string, string> = {
        "/phlebotomy": "/phlebotomy/worklist",
        "/lab-reception": "/reception/accessioning",
        "/lab-testing": "/mlt/worklist",
        "/lab-supervision": "/verification/pending",
        "/pathology": "/clinical/worklist",
        "/report-dispatch": "/dispatch/dashboard",
        "/orders-billing": "/orders-billing/create-order",
    };

    // Module prefix for active-tab highlighting
    const PREFIX_MAP: Record<string, string> = {
        "/phlebotomy": "/phlebotomy",
        "/reception": "/reception",
        "/mlt": "/mlt",
        "/verification": "/verification",
        "/clinical": "/clinical",
        "/dispatch": "/dispatch",
        "/orders-billing": "/orders-billing",
        "/dashboard": "/dashboard",
        "/patients": "/patients",
    };

    const resolveUrl = (url: string) => URL_MAP[url] || url;

    const getNavLabel = (item: NavItem) => {
        if (item.linkUrl === "/lab-supervision") {
            return "Lab Supervisor";
        }

        if (item.linkUrl === "/pathology") {
            return "Pathologist";
        }

        return item.displayText;
    };

    const getRoleTitle = () => {
        if (pathname.startsWith("/verification")) {
            return "Lab Supervisor";
        }

        if (pathname.startsWith("/clinical")) {
            return "Pathologist";
        }

        if (pathname.startsWith("/branch")) {
            return "Admin";
        }

        if (pathname.startsWith("/superadmin")) {
            return "Super Admin";
        }

        return userName;
    };

    const getRoleSubtitle = () => {
        if (pathname.startsWith("/verification")) {
            return "Verification";
        }

        if (pathname.startsWith("/clinical")) {
            return "Clinical Approval";
        }

        if (pathname.startsWith("/branch")) {
            return "Branch Admin";
        }

        if (pathname.startsWith("/superadmin")) {
            return "Super Admin";
        }

        return "Active User";
    };

    const isActive = (url: string) => {
        const resolved = resolveUrl(url);
        // Find the module prefix for this link
        const prefix = Object.values(PREFIX_MAP).find((p) => resolved.startsWith(p));
        if (prefix) return pathname.startsWith(prefix);
        return pathname === resolved || pathname.startsWith(resolved + "/");
    };

    const navItems = useMemo<NavItem[]>(() => {
        if (metadata?.navItems) {
            return sortNavItems(metadata.navItems);
        }
        if (error) {
            if (pathname === "/branch") return [{ displayText: "Branch Management", linkUrl: "/branch" }];
            if (pathname === "/superadmin") return [{ displayText: "Super Admin Management", linkUrl: "/superadmin" }];
            return [{ displayText: "Patient Management", linkUrl: "/dashboard" }];
        }
        return [];
    }, [metadata, error, pathname]);

    return (
        <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50">
            <div className="flex items-center justify-between h-full px-6">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                            <span className="material-icons text-white text-xl">local_hospital</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-900">
                            DURDANS <span className="text-primary">ERP</span>
                        </span>
                    </div>
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map((item, index) => {
                            const href = resolveUrl(item.linkUrl);
                            const active = isActive(item.linkUrl);
                            return (
                                <Link
                                    key={index}
                                    className={`px-4 py-5 text-sm font-semibold transition-colors ${active
                                        ? "text-primary border-b-2 border-primary"
                                        : "text-slate-500 hover:text-primary"
                                        }`}
                                    href={href}
                                >
                                    {getNavLabel(item)}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={logout} className="text-sm text-slate-500 hover:text-primary transition-colors">Logout</button>
                    <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-200">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold leading-none">{userName}</p>
                            <p className="text-xs text-slate-500">{getRoleTitle()} • {getRoleSubtitle()}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold ring-2 ring-primary/10">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
