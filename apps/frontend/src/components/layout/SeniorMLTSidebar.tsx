"use client";

import { ClipboardClock, FileSearch, History, ListChecks } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/**
 * Senior MLT (verification) module navigation.
 *
 * The Critical Values dashboard was removed — its route no longer exists, so it
 * is deliberately absent here (TopNav also filters the backend-served nav row).
 */
const GROUPS: SidebarGroup[] = [
    {
        label: "Verification",
        items: [
            { name: "Verification dashboard", icon: ClipboardClock, href: "/verification/pending" },
            { name: "Bulk approval", icon: ListChecks, href: "/verification/bulk-approval" },
            { name: "Verification history", icon: History, href: "/verification/history" },
            { name: "Review case", icon: FileSearch, href: "/verification/review" },
        ],
    },
];

export default function SeniorMLTSidebar() {
    return <ModuleSidebar ariaLabel="Verification navigation" groups={GROUPS} />;
}
