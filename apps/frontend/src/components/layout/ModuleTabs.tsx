"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { NavItem } from "@/lib/api";
import { useMetadata } from "@/providers/MetadataProvider";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * The module tab bar, shared by every top-bar shell (TopNav, SuperAdminNavbar,
 * AdministrationNavbar, BranchNavbar). A user can hold more than one role
 * (e.g. BRANCH_ADMIN *and* SUPER_ADMIN) — the backend's /metadata endpoint
 * returns one nav item per role the caller holds, so rendering the identical
 * tab list in every shell is what makes every module the user has access to
 * reachable no matter which one they're currently standing in, instead of
 * each shell only offering its own fixed, partial subset.
 */

const NAV_ORDER: Record<string, number> = {
    "/dashboard": 10,
    "/orders-billing": 20,
    "/phlebotomy": 30,
    "/lab-reception": 40,
    "/lab-testing": 50,
    "/lab-supervision": 60,
    "/pathology": 70,
    "/report-dispatch": 80,
    "/branch-admin": 90,
    "/admin": 100,
};

const ROLE_TO_NAV_ITEM: Record<string, NavItem> = {
    "SUPER_ADMIN": { displayText: "Super Admin Management", linkUrl: "/admin" },
    "BRANCH_ADMIN": { displayText: "Branch Management", linkUrl: "/branch-admin" },
    "PHLEBOTOMIST": { displayText: "Phlebotomy", linkUrl: "/phlebotomy" },
    "LAB_RECEPTIONIST": { displayText: "Lab Reception", linkUrl: "/lab-reception" },
    "MLT": { displayText: "Lab Testing", linkUrl: "/lab-testing" },
    "LAB_SUPERVISOR": { displayText: "Lab Supervisor", linkUrl: "/lab-supervision" },
    "PATHOLOGIST": { displayText: "Pathologist", linkUrl: "/pathology" },
    "DISPATCH_OFFICER": { displayText: "Report Dispatch", linkUrl: "/report-dispatch" },
    "BILLING_OFFICER": { displayText: "Orders & Billing", linkUrl: "/orders-billing" },
    "FRONT_DESK": { displayText: "Patient Management", linkUrl: "/dashboard" },
};

const ROLE_DISPLAY_NAMES: Record<string, string> = {
    "SUPER_ADMIN": "Super Admin",
    "BRANCH_ADMIN": "Branch Admin",
    "PHLEBOTOMIST": "Phlebotomist",
    "LAB_RECEPTIONIST": "Lab Receptionist",
    "MLT": "Medical Laboratory Technician",
    "LAB_SUPERVISOR": "Lab Supervisor",
    "PATHOLOGIST": "Pathologist",
    "DISPATCH_OFFICER": "Dispatch Officer",
    "BILLING_OFFICER": "Billing Officer",
    "FRONT_DESK": "Front Desk",
};

/**
 * Short, single-word module labels so the nav never wraps. The backend's
 * displayText is kept as the tooltip so the full name is still discoverable.
 */
const SHORT_LABELS: Record<string, string> = {
    "/dashboard": "Patients",
    "/patients": "Patients",
    "/orders-billing": "Orders",
    "/phlebotomy": "Sampling",
    "/lab-reception": "Lab Reception",
    "/reception": "Lab Reception",
    "/lab-testing": "MLT",
    "/lab-supervision": "Lab Supervisor",
    "/pathology": "Pathologist",
    "/report-dispatch": "Dispatch",
    "/branch": "Branch",
    "/superadmin": "Admin",
    // The seeded nav items use the backend's own linkUrl ("/admin",
    // "/branch-admin"), not the App Router segment.
    "/admin": "Admin",
    "/branch-admin": "Branch",
};

/**
 * Backend linkUrl → the frontend route the tab opens.
 *
 * The seeded nav items for the admin roles are "/admin" and "/branch-admin",
 * but the App Router segments are (protected)/superadmin and (protected)/branch.
 * Leaving these two unmapped means resolveUrl() returns the backend's raw
 * "/admin" unchanged, which 404s — RoleGuard's own PREFIX_MAP already had to
 * work around the exact same mismatch for the access check; this is the other
 * half of that fix, for the actual link a user clicks.
 */
const URL_MAP: Record<string, string> = {
    "/phlebotomy": "/phlebotomy/worklist",
    "/lab-reception": "/reception/accessioning",
    "/lab-testing": "/mlt/worklist",
    "/lab-supervision": "/verification/pending",
    "/pathology": "/clinical/worklist",
    "/report-dispatch": "/dispatch/dashboard",
    "/orders-billing": "/orders-billing/create-order",
    "/admin": "/superadmin",
    "/branch-admin": "/branch",
};

/**
 * Backend linkUrl → every route prefix that belongs to that module (for the active tab).
 * Critical values is no longer a route of its own — it lives inside the supervisor
 * verification screens — so nothing maps to /critical-values any more.
 */
const MODULE_PREFIXES: Record<string, string[]> = {
    "/dashboard": ["/dashboard", "/patients", "/audit"],
    "/orders-billing": ["/orders-billing"],
    "/phlebotomy": ["/phlebotomy"],
    "/lab-reception": ["/reception"],
    "/lab-testing": ["/mlt"],
    "/lab-supervision": ["/verification"],
    "/pathology": ["/clinical"],
    "/report-dispatch": ["/dispatch"],
    "/branch": ["/branch"],
    "/superadmin": ["/superadmin"],
    "/admin": ["/superadmin"],
    "/branch-admin": ["/branch"],
};

const sortNavItems = (items: NavItem[]) =>
    [...new Map(items.map((item) => [item.linkUrl, item])).values()]
        // The /critical-values route is gone, but the backend still serves its
        // header_mapping row — without this the nav renders a 404 link.
        .filter((item) => !["/critical-values", "/lab-supervision", "/pathology", "/branch-admin"].includes(item.linkUrl))
        .sort((a, b) => {
            const aOrder = NAV_ORDER[a.linkUrl] ?? Number.MAX_SAFE_INTEGER;
            const bOrder = NAV_ORDER[b.linkUrl] ?? Number.MAX_SAFE_INTEGER;
            return aOrder - bOrder;
        });

export const resolveModuleUrl = (url: string) => URL_MAP[url] || url;

const getFullLabel = (item: NavItem) => {
    if (item.linkUrl === "/lab-supervision") return "Lab Supervisor";
    if (item.linkUrl === "/pathology") return "Pathologist";
    return item.displayText;
};

const getNavLabel = (item: NavItem) => SHORT_LABELS[item.linkUrl] ?? getFullLabel(item);

export default function ModuleTabs({ ariaLabel = "Modules" }: { ariaLabel?: string }) {
    const pathname = usePathname();
    const { metadata, error } = useMetadata();
    const { roles } = useAuth();

    const isActive = (url: string) => {
        const prefixes = MODULE_PREFIXES[url] ?? [resolveModuleUrl(url)];
        return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
    };

    const navItems = useMemo<NavItem[]>(() => {
        if (roles && roles.length > 0) {
            const items = roles
                .map(role => ROLE_TO_NAV_ITEM[role])
                .filter(Boolean);
            if (items.length > 0) {
                return sortNavItems(items);
            }
        }

        if (metadata?.navItems) return sortNavItems(metadata.navItems);
        if (error) {
            if (pathname.startsWith("/branch")) return [{ displayText: "Branch Management", linkUrl: "/branch-admin" }];
            if (pathname.startsWith("/superadmin")) return [{ displayText: "Super Admin Management", linkUrl: "/admin" }];
            return [{ displayText: "Patient Management", linkUrl: "/dashboard" }];
        }
        return [];
    }, [metadata, error, pathname, roles]);

    return (
        <nav aria-label={ariaLabel} className="no-scrollbar flex h-16 min-w-0 flex-1 items-center overflow-x-auto">
            {roles && roles.length > 0 && (
                <div className="flex shrink-0 items-center mr-4 pr-4 py-1">
                    <span className="text-xs font-semibold text-fg-secondary flex items-center gap-1">
                        {roles.filter(r => ROLE_TO_NAV_ITEM[r]).length > 1 ? "Your Assigned Roles :" : "Your Assigned Role :"}
                        {roles.filter(r => ROLE_TO_NAV_ITEM[r]).map((r, i, arr) => {
                            const item = ROLE_TO_NAV_ITEM[r];
                            const href = resolveModuleUrl(item.linkUrl);
                            const active = isActive(item.linkUrl);
                            return (
                                <span key={r} className="flex items-center">
                                    <Link 
                                        href={href} 
                                        aria-current={active ? "page" : undefined}
                                        className={cn(
                                            "font-bold hover:underline transition-colors",
                                            active ? "text-primary-strong underline decoration-2 underline-offset-4" : "text-primary"
                                        )}
                                    >
                                        {ROLE_DISPLAY_NAMES[r] || r}
                                    </Link>
                                    {i < arr.length - 1 && <span className="text-fg-muted mx-1.5">, </span>}
                                </span>
                            );
                        })}
                        {roles.filter(r => ROLE_TO_NAV_ITEM[r]).length === 0 && <span className="text-primary font-bold">None</span>}
                    </span>
                </div>
            )}
        </nav>
    );
}
