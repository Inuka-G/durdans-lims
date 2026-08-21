"use client";

import { History, Stethoscope } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Clinical authorization (pathologist) module navigation. A case review is opened from the worklist. */
const GROUPS: SidebarGroup[] = [
    {
        label: "Clinical authorization",
        items: [
            { name: "Clinical worklist", icon: Stethoscope, href: "/clinical/worklist" },
            { name: "Clinical history", icon: History, href: "/clinical/history" },
        ],
    },
];

export default function DoctorSidebar() {
    return <ModuleSidebar ariaLabel="Clinical authorization navigation" groups={GROUPS} />;
}
