"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ExternalLink, LifeBuoy, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ModuleSidebar — the one left-nav for every module.
 *
 * Enterprise chrome rules: neutral (no per-item colour), 16px icons, 13px
 * labels, one active state (tinted row + primary text). Colour is reserved
 * for status in the content area, not for navigation decoration.
 *
 *   <ModuleSidebar
 *     ariaLabel="MLT navigation"
 *     groups={[{ label: "Testing", items: [{ name: "Worklist", icon: FlaskConical, href: "/mlt/worklist" }] }]}
 *   />
 */
export type SidebarItem = {
    name: string;
    icon: LucideIcon;
    href: string;
    /** Opens in a new tab with an external marker. */
    external?: boolean;
    /** Override the default "exact or prefix" active test. */
    isActive?: (pathname: string) => boolean;
    /** Small trailing element, e.g. a pending count chip. */
    badge?: ReactNode;
};

export type SidebarGroup = { label?: string; items: SidebarItem[] };

const HELP_EMAIL = "support@durdans.com";

function defaultActive(pathname: string, href: string) {
    if (href.startsWith("http")) return false;
    return pathname === href || pathname.startsWith(href + "/");
}

export default function ModuleSidebar({
    ariaLabel,
    groups,
    footer,
    hideHelp = false,
}: {
    ariaLabel: string;
    groups: SidebarGroup[];
    /** Extra footer content above the Help link (e.g. a branch switcher). */
    footer?: ReactNode;
    hideHelp?: boolean;
}) {
    const pathname = usePathname();

    return (
        <aside
            aria-label={ariaLabel}
            className="fixed top-16 hidden h-[calc(100vh-4rem)] w-64 flex-col overflow-hidden border-r border-edge bg-surface lg:flex"
        >
            <nav className="flex-1 overflow-y-auto px-3 py-4">
                {groups.map((group, gi) => (
                    <div key={group.label ?? gi} className={cn(gi > 0 && "mt-6")}>
                        {group.label && (
                            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">{group.label}</p>
                        )}
                        <ul className="space-y-0.5">
                            {group.items.map((item) => {
                                const active = item.isActive ? item.isActive(pathname) : defaultActive(pathname, item.href);
                                const Icon = item.icon;
                                const className = cn(
                                    "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                    active ? "bg-primary-soft text-primary-strong" : "text-fg-secondary hover:bg-surface-hover hover:text-fg"
                                );
                                const content = (
                                    <>
                                        <Icon
                                            className={cn("h-4 w-4 shrink-0", active ? "text-primary-strong" : "text-fg-faint group-hover:text-fg-secondary")}
                                            aria-hidden="true"
                                        />
                                        <span className="truncate">{item.name}</span>
                                        {item.badge && <span className="ml-auto shrink-0">{item.badge}</span>}
                                        {item.external && (
                                            <ExternalLink
                                                className={cn("h-3 w-3 shrink-0 text-fg-faint group-hover:text-fg-muted", !item.badge && "ml-auto")}
                                                aria-hidden="true"
                                            />
                                        )}
                                    </>
                                );
                                return (
                                    <li key={item.href}>
                                        {item.external ? (
                                            <a
                                                href={item.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={className}
                                                aria-label={`${item.name} (opens in new tab)`}
                                            >
                                                {content}
                                            </a>
                                        ) : (
                                            <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
                                                {content}
                                            </Link>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {(footer || !hideHelp) && (
                <div className="shrink-0 border-t border-edge bg-surface px-3 py-3">
                    {footer && <div className={cn(!hideHelp && "mb-2")}>{footer}</div>}
                    {!hideHelp && (
                        <a
                            href={`mailto:${HELP_EMAIL}`}
                            aria-label={`Help and support - email ${HELP_EMAIL}`}
                            className="group flex items-center gap-2.5 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-edge hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-edge bg-surface-muted text-fg-muted transition-colors group-hover:text-fg-secondary">
                                <LifeBuoy className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-fg-secondary group-hover:text-fg">
                                    Help and support
                                </span>
                                <span className="block truncate text-xs text-fg-muted">{HELP_EMAIL}</span>
                            </span>
                            <Mail
                                className="h-3.5 w-3.5 shrink-0 text-fg-faint opacity-0 transition-opacity group-hover:opacity-100"
                                aria-hidden="true"
                            />
                        </a>
                    )}
                </div>
            )}
        </aside>
    );
}
