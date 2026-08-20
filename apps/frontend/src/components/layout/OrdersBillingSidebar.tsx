"use client";

import { ClipboardList, CreditCard, ShoppingCart, TrendingUp } from "lucide-react";
import ModuleSidebar, { type SidebarGroup } from "@/components/ui/ModuleSidebar";

/** Orders & Billing module navigation. */
const GROUPS: SidebarGroup[] = [
    {
        label: "Orders & billing",
        items: [
            { name: "Create order", icon: ShoppingCart, href: "/orders-billing/create-order" },
            { name: "All orders", icon: ClipboardList, href: "/orders-billing/orders" },
            { name: "Bills & payments", icon: CreditCard, href: "/orders-billing/bills" },
        ],
    },
    {
        label: "Reports",
        items: [{ name: "Revenue analysis", icon: TrendingUp, href: "/orders-billing/revenue-analysis" }],
    },
];

export default function OrdersBillingSidebar() {
    return <ModuleSidebar ariaLabel="Orders and billing navigation" groups={GROUPS} />;
}
