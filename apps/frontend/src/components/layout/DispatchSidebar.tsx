"use client";

import { BadgeCheck, CircleAlert, LayoutDashboard, Truck } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Report dispatch module navigation. */
const GROUPS: SidebarGroup[] = [
    {
        label: "Report dispatch",
        items: [
            { name: "Dispatch dashboard", icon: LayoutDashboard, href: "/dispatch/dashboard" },
            { name: "Delivery status", icon: Truck, href: "/dispatch/delivery-status" },
            { name: "Failed deliveries", icon: CircleAlert, href: "/dispatch/failed-deliveries" },
            { name: "Authorized reports", icon: BadgeCheck, href: "/dispatch/authorized-reports" },
        ],
    },
];

export default function DispatchSidebar() {
    return <ModuleSidebar ariaLabel="Dispatch navigation" groups={GROUPS} />;
}
