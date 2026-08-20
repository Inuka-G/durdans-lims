"use client";

import { ClipboardList, History, Package, Printer } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Phlebotomy module navigation. */
const GROUPS: SidebarGroup[] = [
    {
        label: "Phlebotomy",
        items: [
            { name: "Sample worklist", icon: ClipboardList, href: "/phlebotomy/worklist" },
            { name: "Collection history", icon: History, href: "/phlebotomy/collection-history" },
            { name: "Label print", icon: Printer, href: "/phlebotomy/label-print" },
            { name: "Supplies inventory", icon: Package, href: "/phlebotomy/supplies" },
        ],
    },
];

export default function PhlebotomySidebar() {
    return <ModuleSidebar ariaLabel="Phlebotomy navigation" groups={GROUPS} />;
}
