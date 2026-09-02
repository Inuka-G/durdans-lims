"use client";

import { Building2, History, Shield, ShieldCheck, UserCog } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Original rule: plain prefix match for every item. */
const startsWith = (href: string) => (p: string) => p.startsWith(href);

/** Administration (super admin access management) navigation. */
const GROUPS: SidebarGroup[] = [
    {
        label: "Access management",
        items: [
            { name: "Global user control", icon: UserCog, href: "/superadmin/users", isActive: startsWith("/superadmin/users") },
            { name: "Branch management", icon: Building2, href: "/superadmin/admin/branches", isActive: startsWith("/superadmin/admin/branches") },
            { name: "Audit trails", icon: History, href: "/superadmin/admin/audit", isActive: startsWith("/superadmin/admin/audit") },
        ],
    },
];

export default function AdministrationSidebar() {
    return <ModuleSidebar ariaLabel="Administration navigation" groups={GROUPS} />;
}
