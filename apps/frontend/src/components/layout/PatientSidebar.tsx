"use client";

import { LayoutDashboard, ClipboardList, User } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Patient Portal module navigation. */
const GROUPS: SidebarGroup[] = [
    {
        label: "My Portal",
        items: [
            { 
                name: "Dashboard", 
                icon: LayoutDashboard, 
                href: "/patient-portal",
                isActive: (pathname) => pathname === "/patient-portal"
            },
            { name: "My Orders", icon: ClipboardList, href: "/patient-portal/orders" },
            { name: "My Profile", icon: User, href: "/patient-portal/profile" },
        ],
    },
];

export default function PatientSidebar() {
    return <ModuleSidebar ariaLabel="Patient navigation" groups={GROUPS} />;
}
