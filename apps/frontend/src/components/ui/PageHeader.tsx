"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/**
 * PageHeader — identical header for every page in the module:
 *   breadcrumb (optional) → title (20px/600) + meta line → actions on the right.
 * Sentence case titles; at most one primary Button in `actions`.
 */
export default function PageHeader({
    title,
    meta,
    crumbs,
    actions,
    className,
}: {
    title: ReactNode;
    /** Secondary line under the title: branch, date, record id, status… */
    meta?: ReactNode;
    crumbs?: Crumb[];
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
            <div className="min-w-0">
                {crumbs && crumbs.length > 0 && (
                    <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-fg-muted">
                        {crumbs.map((c, i) => {
                            const last = i === crumbs.length - 1;
                            return (
                                <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1">
                                    {c.href && !last ? (
                                        <Link
                                            href={c.href}
                                            className="rounded hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                        >
                                            {c.label}
                                        </Link>
                                    ) : (
                                        <span className={cn(last && "text-fg-secondary")} aria-current={last ? "page" : undefined}>
                                            {c.label}
                                        </span>
                                    )}
                                    {!last && <ChevronRight className="h-3 w-3 text-fg-faint" aria-hidden="true" />}
                                </span>
                            );
                        })}
                    </nav>
                )}
                <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
                {meta && <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-fg-muted">{meta}</div>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
