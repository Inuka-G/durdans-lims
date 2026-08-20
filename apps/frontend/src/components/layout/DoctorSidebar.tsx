"use client";

import { ClipboardCheck, History, Stethoscope } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Clinical validation (doctor) module navigation. */
const GROUPS: SidebarGroup[] = [
    {
        label: "Clinical validation",
        items: [
            { name: "Clinical worklist", icon: Stethoscope, href: "/clinical/worklist" },
            { name: "Review case", icon: ClipboardCheck, href: "/clinical/review" },
            { name: "Clinical history", icon: History, href: "/clinical/history" },
        ],
    },
];

export default function DoctorSidebar() {
    return <ModuleSidebar ariaLabel="Clinical validation navigation" groups={GROUPS} />;
}
