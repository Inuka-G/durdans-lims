"use client";

import { Activity, ChartColumn, Database, LayoutDashboard, Network, UserCog } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Original rule: the root is exact-match only, every other item is a plain prefix match. */
const startsWith = (href: string) => (p: string) => p.startsWith(href);

/** Super admin (global) module navigation. */
const GROUPS: SidebarGroup[] = [
    {
        label: "Global",
        items: [
            { name: "Global dashboard", icon: LayoutDashboard, href: "/superadmin", isActive: (p) => p === "/superadmin" },
            { name: "Branch management", icon: Network, href: "/superadmin/admin/branches", isActive: startsWith("/superadmin/admin/branches") },
            { name: "User & role control", icon: UserCog, href: "/superadmin/users", isActive: startsWith("/superadmin/users") },
            { name: "Master data", icon: Database, href: "/superadmin/master-data", isActive: startsWith("/superadmin/master-data") },
            { name: "System monitoring", icon: Activity, href: "/superadmin/monitoring", isActive: startsWith("/superadmin/monitoring") },
            { name: "Cross-branch reports", icon: ChartColumn, href: "/superadmin/reports", isActive: startsWith("/superadmin/reports") },
        ],
    },
];

export default function Sidebar() {
    return <ModuleSidebar ariaLabel="Super admin navigation" groups={GROUPS} />;
}
