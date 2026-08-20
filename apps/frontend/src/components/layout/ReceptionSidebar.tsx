"use client";

import { BadgeCheck, ClipboardList, History, ScanBarcode } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Lab Reception module navigation. */
const GROUPS: SidebarGroup[] = [
    {
        label: "Lab reception",
        items: [
            { name: "Reception worklist", icon: ClipboardList, href: "/reception/accessioning" },
            { name: "Quality verification", icon: BadgeCheck, href: "/reception/quality-verification" },
            { name: "Barcode print", icon: ScanBarcode, href: "/reception/barcode-print" },
            { name: "Accessioning logs", icon: History, href: "/reception/logs" },
        ],
    },
];

export default function ReceptionSidebar() {
    return <ModuleSidebar ariaLabel="Lab reception navigation" groups={GROUPS} />;
}
