"use client";

import { BadgeCheck, CircleAlert, History, LayoutDashboard } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Report dispatch module navigation. */
const GROUPS: SidebarGroup[] = [
    {
        label: "Report dispatch",
        items: [
            {
                name: "Dispatch worklist",
                icon: LayoutDashboard,
                href: "/dispatch/dashboard",
                isActive: (pathname) => pathname === "/dispatch/dashboard" || pathname === "/dispatch",
            },
            {
                name: "Review report",
                icon: BadgeCheck,
                href: "/dispatch/authorized-reports",
                isActive: (pathname) => pathname.startsWith("/dispatch/authorized-reports"),
            },
            {
                name: "Delivery history",
                icon: History,
                href: "/dispatch/delivery-status",
                isActive: (pathname) => pathname === "/dispatch/delivery-status",
            },
            {
                name: "Failed deliveries",
                icon: CircleAlert,
                href: "/dispatch/failed-deliveries",
                isActive: (pathname) => pathname === "/dispatch/failed-deliveries",
            },
        ],
    },
];

export default function DispatchSidebar() {
    return <ModuleSidebar ariaLabel="Dispatch navigation" groups={GROUPS} />;
}
