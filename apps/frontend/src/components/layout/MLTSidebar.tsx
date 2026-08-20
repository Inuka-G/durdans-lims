"use client";

import { ChartColumn, ClipboardList, FilePen, FlaskConical, Microscope } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** MLT (testing) module navigation. */
const GROUPS: SidebarGroup[] = [
    {
        label: "MLT testing",
        items: [
            { name: "Sample worklist", icon: FlaskConical, href: "/mlt/worklist" },
            { name: "All worklist", icon: ClipboardList, href: "/mlt/all-worklist" },
            { name: "Result entry", icon: FilePen, href: "/mlt/result-entry" },
        ],
    },
    {
        label: "Tools",
        items: [
            { name: "QC dashboard", icon: ChartColumn, href: "/mlt/qc-dashboard" },
            { name: "Instruments", icon: Microscope, href: "/mlt/instruments" },
        ],
    },
];

export default function MLTSidebar() {
    return <ModuleSidebar ariaLabel="MLT navigation" groups={GROUPS} />;
}
