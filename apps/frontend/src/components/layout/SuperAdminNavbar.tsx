"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Activity, Check, ChevronDown, Hospital, LogOut, MapPin, Monitor, Moon, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, type ThemePreference } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import ModuleTabs from "@/components/layout/ModuleTabs";
import AccountStatusBadge from "@/components/layout/AccountStatusBadge";

/**
 * Super admin (global) top bar. Same shell as TopNav: brand, context chip
 * (branch switcher, or the environment on the monitoring page), module tabs,
 * account menu (theme + log out). The module tabs are the same shared
 * ModuleTabs every other shell renders — a user can hold more than one role
 * (e.g. BRANCH_ADMIN and SUPER_ADMIN together), and this is what lets them
 * jump to their other role's screens instead of being stuck showing only
 * this shell's own two destinations.
 */
const BRANCHES = ["All Branches", "Colombo Branch", "Kandy Regional Center", "Galle Southern Hub"];

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
];

/** APG menu-button behaviour shared by the branch switcher and the account menu. */
function useMenuButton() {
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const firstItemRef = useRef<HTMLButtonElement | null>(null);

    const close = (restoreFocus = true) => {
        setOpen(false);
        if (restoreFocus) triggerRef.current?.focus();
    };

    useEffect(() => {
        if (!open) return;
        // Move focus into the menu (APG menu-button pattern).
        firstItemRef.current?.focus();
        const onPointerDown = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [open]);

    const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape") {
            e.preventDefault();
            close();
            return;
        }
        if (e.key === "Tab") {
            // Tab leaves the menu: close it so it doesn't linger over the page.
            setOpen(false);
            return;
        }
        if (!open || (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End")) return;
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
            setOpen(true);
        }
    };

    return { open, setOpen, close, menuRef, triggerRef, firstItemRef, onMenuKeyDown, onTriggerKeyDown };
}

export default function SuperAdminNavbar() {
    const pathname = usePathname();
    const { logout, user } = useAuth();
    const { theme, setTheme } = useTheme();
    const [selectedBranch, setSelectedBranch] = useState("All Branches");

    const isMonitoring = pathname === "/superadmin/monitoring";

    const userName = user?.name || user?.preferred_username || "User";

    const { open: branchOpen, setOpen: setBranchOpen, close: closeBranchMenu, menuRef: branchMenuRef, triggerRef: branchTriggerRef, firstItemRef: branchFirstItemRef, onMenuKeyDown: onBranchMenuKeyDown, onTriggerKeyDown: onBranchTriggerKeyDown } = useMenuButton();
    const { open: accountOpen, setOpen: setAccountOpen, close: closeAccountMenu, menuRef: accountMenuRef, triggerRef: accountTriggerRef, firstItemRef: accountFirstItemRef, onMenuKeyDown: onAccountMenuKeyDown, onTriggerKeyDown: onAccountTriggerKeyDown } = useMenuButton();

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-edge bg-surface">
            <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6">
                <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-6">
                    <div className="flex shrink-0 items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
                            <Hospital className="h-5 w-5 text-white" aria-hidden="true" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-fg">
                            DURDANS <span className="text-primary">ERP</span>
                        </span>
                    </div>

                    {/* Context chip: environment on the monitoring page, branch switcher elsewhere */}
                    {isMonitoring ? (
                        <span
                            className="hidden max-w-[240px] shrink-0 items-center gap-1.5 truncate rounded-md border border-edge bg-surface-muted px-2 py-1 text-xs font-medium text-fg-secondary sm:inline-flex"
                            title="Environment · Live infrastructure status"
                        >
                            <Activity className="h-3.5 w-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
                            <span className="sr-only">Environment:</span>
                            <span className="truncate">Production Cluster-01</span>
                        </span>
                    ) : (
                        <div ref={branchMenuRef} className="relative shrink-0" onKeyDown={onBranchMenuKeyDown}>
                            <button
                                ref={branchTriggerRef}
                                type="button"
                                onClick={() => setBranchOpen((v) => !v)}
                                onKeyDown={onBranchTriggerKeyDown}
                                aria-haspopup="menu"
                                aria-expanded={branchOpen}
                                aria-label={`Branch: ${selectedBranch}. Switch branch`}
                                title="Switch branch"
                                className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md border border-edge bg-surface-muted px-2 py-1 text-xs font-medium text-fg-secondary transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                <MapPin className="h-3.5 w-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
                                <span className="truncate">{selectedBranch}</span>
                                <ChevronDown
                                    className={cn("h-3.5 w-3.5 shrink-0 text-fg-faint transition-transform", branchOpen && "rotate-180")}
                                    aria-hidden="true"
                                />
                            </button>

                            {branchOpen && (
                                <div
                                    role="menu"
                                    aria-label="Branch"
                                    className="absolute left-0 mt-1.5 w-56 overflow-hidden rounded-md border border-edge bg-surface p-1 shadow-lg shadow-black/10"
                                >
                                    {BRANCHES.map((branch, i) => {
                                        const selected = selectedBranch === branch;
                                        return (
                                            <button
                                                key={branch}
                                                ref={i === 0 ? branchFirstItemRef : undefined}
                                                type="button"
                                                role="menuitemradio"
                                                aria-checked={selected}
                                                onClick={() => {
                                                    setSelectedBranch(branch);
                                                    closeBranchMenu();
                                                }}
                                                className={cn(
                                                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none",
                                                    selected ? "text-primary-strong" : "text-fg-secondary"
                                                )}
                                            >
                                                <span className="truncate">{branch}</span>
                                                {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary-strong" aria-hidden="true" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <ModuleTabs ariaLabel="Super admin" />
                </div>

                {/* Account menu (Logout lives here, not in the nav bar) */}
                <div ref={accountMenuRef} className="relative shrink-0" onKeyDown={onAccountMenuKeyDown}>
                    <button
                        ref={accountTriggerRef}
                        type="button"
                        onClick={() => setAccountOpen((v) => !v)}
                        onKeyDown={onAccountTriggerKeyDown}
                        aria-haspopup="menu"
                        aria-expanded={accountOpen}
                        aria-label={`Account menu for ${userName}`}
                        className="flex items-center gap-3 rounded-md py-1 pl-2 pr-1.5 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <span className="hidden text-right lg:block">
                            <span className="block text-sm font-semibold leading-tight text-fg">{userName}</span>
                            <span className="block text-[12px] leading-tight">
                                <AccountStatusBadge />
                            </span>
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-strong">
                            {userName.charAt(0).toUpperCase()}
                        </span>
                        <ChevronDown
                            className={cn("h-4 w-4 text-fg-faint transition-transform", accountOpen && "rotate-180")}
                            aria-hidden="true"
                        />
                    </button>

                    {accountOpen && (
                        <div className="absolute right-0 mt-1.5 w-60 overflow-hidden rounded-md border border-edge bg-surface py-1 shadow-lg shadow-black/10">
                            <div className="border-b border-edge px-3 py-2">
                                <p className="truncate text-sm font-medium text-fg">{userName}</p>
                                <p className="truncate text-[12px]">
                                    <AccountStatusBadge />
                                </p>
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
                                                ref={i === 0 ? accountFirstItemRef : undefined}
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
                                        closeAccountMenu(false);
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
