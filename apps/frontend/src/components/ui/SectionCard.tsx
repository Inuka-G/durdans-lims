"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * SectionCard — the single container used for every dashboard panel.
 * Header: title (14px/600) + optional count + right-side actions.
 * Body: whatever the panel holds; `flush` removes padding for tables/lists.
 */
export default function SectionCard({
    title,
    count,
    actions,
    children,
    flush = false,
    className,
    bodyClassName,
}: {
    title: string;
    count?: number | string;
    actions?: ReactNode;
    children: ReactNode;
    flush?: boolean;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section className={cn("flex flex-col rounded-lg border border-edge bg-surface", className)}>
            <header className="flex min-h-[44px] flex-wrap items-center gap-x-2 gap-y-1 border-b border-edge px-4 py-2">
                <h2 className="min-w-0 truncate text-sm font-semibold text-fg">{title}</h2>
                {count !== undefined && (
                    <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[12px] font-medium tabular-nums text-fg-secondary">
                        {count}
                    </span>
                )}
                {actions && <div className="ml-auto flex min-w-0 items-center gap-2">{actions}</div>}
            </header>
            <div className={cn("min-h-0 flex-1", !flush && "p-4", bodyClassName)}>{children}</div>
        </section>
    );
}
