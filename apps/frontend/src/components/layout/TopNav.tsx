"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { NavItem } from "@/lib/api";
import { useMetadata } from "@/providers/MetadataProvider";
import { usePathname } from "next/navigation";
import { Building2, Check, ChevronDown, LogOut, Monitor, Moon, Stethoscope, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";

const NAV_ORDER: Record<string, number> = {
    "/dashboard": 10,
    "/orders-billing": 20,
    "/phlebotomy": 30,
    "/lab-reception": 40,
    "/lab-testing": 50,
    "/lab-supervision": 60,
    "/pathology": 70,
    "/report-dispatch": 80,
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
    "/lab-reception": "Reception",
    "/lab-testing": "MLT",
    "/lab-supervision": "Supervisor",
    "/pathology": "Pathology",
    "/report-dispatch": "Dispatch",
    "/branch": "Branch",
    "/superadmin": "Admin",
};

/** Backend linkUrl → the frontend route the tab opens. */
const URL_MAP: Record<string, string> = {
    "/phlebotomy": "/phlebotomy/worklist",
    "/lab-reception": "/reception/accessioning",
    "/lab-testing": "/mlt/worklist",
    "/lab-supervision": "/verification/pending",
    "/pathology": "/clinical/worklist",
    "/report-dispatch": "/dispatch/dashboard",
    "/orders-billing": "/orders-billing/create-order",
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
};

const sortNavItems = (items: NavItem[]) =>
    [...new Map(items.map((item) => [item.linkUrl, item])).values()]
        // The /critical-values route is gone, but the backend still serves its
        // header_mapping row — without this the supervisor nav renders a 404 link.
        .filter((item) => item.linkUrl !== "/critical-values")
        .sort((a, b) => {
            const aOrder = NAV_ORDER[a.linkUrl] ?? Number.MAX_SAFE_INTEGER;
            const bOrder = NAV_ORDER[b.linkUrl] ?? Number.MAX_SAFE_INTEGER;
            return aOrder - bOrder;
        });

const resolveUrl = (url: string) => URL_MAP[url] || url;

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
];

const getFullLabel = (item: NavItem) => {
    if (item.linkUrl === "/lab-supervision") return "Lab Supervisor";
    if (item.linkUrl === "/pathology") return "Pathologist";
    return item.displayText;
};

const getNavLabel = (item: NavItem) => SHORT_LABELS[item.linkUrl] ?? getFullLabel(item);

export default function TopNav() {
    const { logout, user } = useAuth();
    const pathname = usePathname();
    const { metadata, error } = useMetadata();
    const { theme, setTheme } = useTheme();

    // Use fallback values if token parsing fails
    const userName = user?.name || user?.preferred_username || "User";

    /**
     * The account chip names who is signed in, nothing more. It used to swap in a
     * role title per module ("Lab Supervisor · Verification" on /verification,
     * "Pathologist · Clinical Approval" on /clinical), which read as a second
     * identity next to the name — and the active module tab already says where you are.
     */
    const subtitleLine = "Active User";

    const isActive = (url: string) => {
        const prefixes = MODULE_PREFIXES[url] ?? [resolveUrl(url)];
        return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
    };

    const navItems = useMemo<NavItem[]>(() => {
        if (metadata?.navItems) return sortNavItems(metadata.navItems);
        if (error) {
            if (pathname === "/branch") return [{ displayText: "Branch Management", linkUrl: "/branch" }];
            if (pathname === "/superadmin") return [{ displayText: "Super Admin Management", linkUrl: "/superadmin" }];
            return [{ displayText: "Patient Management", linkUrl: "/dashboard" }];
        }
        return [];
    }, [metadata, error, pathname]);

    /* ── Account menu (Logout lives here, not in the nav bar) ── */
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const firstItemRef = useRef<HTMLButtonElement | null>(null);

    const closeMenu = (restoreFocus = true) => {
        setMenuOpen(false);
        if (restoreFocus) triggerRef.current?.focus();
    };

    useEffect(() => {
        if (!menuOpen) return;
        // Move focus into the menu (APG menu-button pattern).
        firstItemRef.current?.focus();
        const onPointerDown = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [menuOpen]);

    const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape") {
            e.preventDefault();
            closeMenu();
            return;
        }
        if (e.key === "Tab") {
            // Tab leaves the menu: close it so it doesn't linger over the page.
            setMenuOpen(false);
            return;
        }
        if (!menuOpen || (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End")) return;
        const items = Array.from(
            menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"],[role="menuitemradio"]') ?? []
        );
        if (items.length === 0) return;
        e.preventDefault();
        const current = items.indexOf(document.activeElement as HTMLElement);
        let next = 0;
        if (e.key === "ArrowDown") next = (current + 1) % items.length;
        else if (e.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
        else if (e.key === "End") next = items.length - 1;
        items[next]?.focus();
    };

    const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setMenuOpen(true);
        }
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-edge bg-surface">
            <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6">
                <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-6">
                    <div className="flex shrink-0 items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
                            <Stethoscope className="h-[18px] w-[18px] text-white" aria-hidden="true" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-fg">
                            DURDANS <span className="text-primary">ERP</span>
                        </span>
                    </div>

                    {metadata?.currentBranchName && (
                        <span
                            className="hidden max-w-[200px] shrink-0 items-center gap-1.5 truncate rounded-md border border-edge bg-surface-muted px-2 py-1 text-xs font-medium text-fg-secondary lg:inline-flex"
                            title="Current branch"
                        >
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
                            <span className="truncate">{metadata.currentBranchName}</span>
                        </span>
                    )}

                    {/* Module tabs: never wrap; scroll horizontally when there isn't room. */}
                    <nav
                        aria-label="Modules"
                        className="no-scrollbar flex h-16 min-w-0 flex-1 items-center overflow-x-auto"
                    >
                        {navItems.map((item) => {
                            const href = resolveUrl(item.linkUrl);
                            const active = isActive(item.linkUrl);
                            return (
                                <Link
                                    key={item.linkUrl}
                                    href={href}
                                    title={getFullLabel(item)}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "relative flex h-16 shrink-0 items-center whitespace-nowrap px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                                        active ? "text-primary-strong" : "text-fg-secondary hover:text-fg"
                                    )}
                                >
                                    {getNavLabel(item)}
                                    {active && (
                                        <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 rounded-t bg-primary" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div ref={menuRef} className="relative shrink-0" onKeyDown={onMenuKeyDown}>
                    <button
                        ref={triggerRef}
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        onKeyDown={onTriggerKeyDown}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        aria-label={`Account menu for ${userName}`}
                        className="flex items-center gap-3 rounded-md py-1 pl-2 pr-1.5 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <span className="hidden min-w-0 max-w-[200px] text-right lg:block">
                            <span className="block truncate text-sm font-semibold leading-tight text-fg" title={userName}>
                                {userName}
                            </span>
                            <span className="block truncate text-[12px] leading-tight text-fg-muted">{subtitleLine}</span>
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-strong">
                            {userName.charAt(0).toUpperCase()}
                        </span>
                        <ChevronDown className={cn("h-4 w-4 text-fg-faint transition-transform", menuOpen && "rotate-180")} aria-hidden="true" />
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 mt-1.5 w-60 overflow-hidden rounded-md border border-edge bg-surface py-1 shadow-lg shadow-black/10">
                            <div className="border-b border-edge px-3 py-2">
                                <p className="truncate text-sm font-medium text-fg">{userName}</p>
                                <p className="truncate text-[12px] text-fg-muted">{subtitleLine}</p>
                            </div>
                            <div role="menu" aria-label="Account">
                                <div className="px-3 pb-1 pt-2 text-[12px] font-medium uppercase tracking-wide text-fg-muted" id="theme-group-label">
                                    Theme
                                </div>
                                <div role="group" aria-labelledby="theme-group-label" className="px-1 pb-1">
                                    {THEME_OPTIONS.map((opt, i) => {
                                        const Icon = opt.icon;
                                        const selected = theme === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                ref={i === 0 ? firstItemRef : undefined}
                                                type="button"
                                                role="menuitemradio"
                                                aria-checked={selected}
                                                onClick={() => setTheme(opt.value)}
                                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-fg-secondary transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                                            >
                                                <Icon className="h-4 w-4 text-fg-faint" aria-hidden="true" />
                                                {opt.label}
                                                {selected && <Check className="ml-auto h-4 w-4 text-primary-strong" aria-hidden="true" />}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="my-1 border-t border-edge" role="separator" />
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        closeMenu(false);
                                        logout();
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-fg-secondary transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                                >
                                    <LogOut className="h-4 w-4 text-fg-faint" aria-hidden="true" />
                                    Log out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
