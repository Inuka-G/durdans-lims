"use client";

import { ClipboardClock, FileSearch, History, ListChecks, TriangleAlert } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Senior MLT (verification) module navigation. Also covers /critical-values. */
const GROUPS: SidebarGroup[] = [
    {
        label: "Verification",
        items: [
            { name: "Verification dashboard", icon: ClipboardClock, href: "/verification/pending" },
            { name: "Bulk approval", icon: ListChecks, href: "/verification/bulk-approval" },
            { name: "Verification history", icon: History, href: "/verification/history" },
            { name: "Review case", icon: FileSearch, href: "/verification/review" },
            { name: "Critical values", icon: TriangleAlert, href: "/critical-values" },
        ],
    },
];

export default function SeniorMLTSidebar() {
    return <ModuleSidebar ariaLabel="Verification navigation" groups={GROUPS} />;
}
