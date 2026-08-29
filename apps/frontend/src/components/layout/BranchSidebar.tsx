"use client";

import { ChartColumn, History, LayoutGrid, Users, Beaker } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Branch admin module navigation. */
const GROUPS: SidebarGroup[] = [
    {
        label: "Branch",
        items: [
            { name: "Dashboard", icon: LayoutGrid, href: "/branch", isActive: (p) => p === "/branch" },
            { name: "User management", icon: Users, href: "/branch/users", isActive: (p) => p.startsWith("/branch/users") },
            { name: "Branch reports", icon: ChartColumn, href: "/branch/reports", isActive: (p) => p.startsWith("/branch/reports") },
            { name: "Activity logs", icon: History, href: "/branch/activity-logs", isActive: (p) => p.startsWith("/branch/activity-logs") },
            { name: "Test management", icon: Beaker, href: "/branch/test-management", isActive: (p) => p.startsWith("/branch/test-management") },
        ],
    },
];

export default function BranchSidebar() {
    return <ModuleSidebar ariaLabel="Branch admin navigation" groups={GROUPS} />;
}
