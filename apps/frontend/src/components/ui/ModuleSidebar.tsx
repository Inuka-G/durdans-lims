"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ExternalLink, LifeBuoy } from "lucide-react";
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
            className="fixed top-16 hidden h-[calc(100vh-4rem)] w-64 flex-col overflow-y-auto border-r border-edge bg-surface lg:flex"
        >
            <nav className="flex-1 px-3 py-4">
                {groups.map((group, gi) => (
                    <div key={group.label ?? gi} className={cn(gi > 0 && "mt-6")}>
                        {group.label && (
                            <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-fg-muted">{group.label}</p>
                        )}
                        <ul className="space-y-0.5">
                            {group.items.map((item) => {
                                const active = item.isActive ? item.isActive(pathname) : defaultActive(pathname, item.href);
                                const Icon = item.icon;
                                const className = cn(
                                    "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
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
                <div className="border-t border-edge px-3 py-3">
                    {footer}
                    {!hideHelp && (
                        <a
                            href="mailto:support@durdans.com"
                            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <LifeBuoy className="h-4 w-4 text-fg-faint" aria-hidden="true" />
                            Help and support
                        </a>
                    )}
                </div>
            )}
        </aside>
    );
}
