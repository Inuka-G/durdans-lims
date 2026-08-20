"use client";

import { CalendarClock, History, LayoutDashboard, Search, UserPlus } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Patient Management module navigation. */
const GROUPS: SidebarGroup[] = [
    {
        label: "Patients",
        items: [
            { name: "Overview", icon: LayoutDashboard, href: "/dashboard", isActive: (p) => p === "/dashboard" },
            { name: "Register patient", icon: UserPlus, href: "/patients/new" },
            {
                name: "Search patients",
                icon: Search,
                href: "/patients",
                isActive: (p) => p.startsWith("/patients") && !p.startsWith("/patients/new"),
            },
        ],
    },
    {
        label: "Shortcuts",
        items: [
            { name: "Daily appointments", icon: CalendarClock, href: "https://www.durdans.com/appointments/", external: true },
            { name: "Audit log", icon: History, href: "/audit" },
        ],
    },
];

export default function Sidebar() {
    return <ModuleSidebar ariaLabel="Patient module navigation" groups={GROUPS} />;
}
