"use client";

import { ClipboardClock, History, ListChecks } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/**
 * Lab supervisor (verification) module navigation: the dashboard, the bulk
 * approval screen and the audit history. A case review is reached from those
 * lists, not from the sidebar — there is no case to review without picking one.
 */
const GROUPS: SidebarGroup[] = [
    {
        label: "Verification",
        items: [
            {
                name: "Verification dashboard",
                icon: ClipboardClock,
                href: "/verification/pending",
                isActive: (pathname) => pathname === "/verification/pending" || pathname === "/verification",
            },
            {
                name: "Review case",
                icon: ListChecks,
                href: "/verification/review",
                isActive: (pathname) => pathname.startsWith("/verification/review"),
            },
            { name: "Bulk approval", icon: ListChecks, href: "/verification/bulk-approval" },
            { name: "Verification history", icon: History, href: "/verification/history" },
        ],
    },
];

export default function SeniorMLTSidebar() {
    return <ModuleSidebar ariaLabel="Verification navigation" groups={GROUPS} />;
}
