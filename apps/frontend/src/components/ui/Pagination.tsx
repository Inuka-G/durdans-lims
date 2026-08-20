"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Pagination — 1-based pages, compact "Showing a–b of n" + prev/next + page numbers
 * (windowed around the current page so 40 pages don't render 40 buttons).
 * Drop into the footer of a `SectionCard flush`.
 */
export default function Pagination({
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    onPageChange,
    itemLabel = "items",
    className,
}: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    itemLabel?: string;
    className?: string;
}) {
    const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);
    const pages = windowed(currentPage, Math.max(1, totalPages));

    return (
        <nav
            aria-label="Pagination"
            className={cn("flex flex-wrap items-center justify-between gap-2 border-t border-edge px-4 py-2 text-xs text-fg-muted", className)}
        >
            <p className="tabular-nums">
                Showing {start}–{end} of {totalItems} {itemLabel}
            </p>
            <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" icon={ChevronLeft} aria-label="Previous page" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} />
                {pages.map((p, i) =>
                    p === "…" ? (
                        <span key={`gap-${i}`} className="px-1 text-fg-faint" aria-hidden="true">
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onPageChange(p)}
                            aria-current={p === currentPage ? "page" : undefined}
                            aria-label={`Page ${p}`}
                            className={cn(
                                "h-7 min-w-7 rounded-md px-1.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                p === currentPage ? "bg-primary-soft text-primary-strong" : "text-fg-secondary hover:bg-surface-hover hover:text-fg"
                            )}
                        >
                            {p}
                        </button>
                    )
                )}
                <Button size="sm" variant="ghost" icon={ChevronRight} aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} />
            </div>
        </nav>
    );
}

/** 1 … 4 5 [6] 7 8 … 20 */
function windowed(current: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out: (number | "…")[] = [1];
    const lo = Math.max(2, current - 1);
    const hi = Math.min(total - 1, current + 1);
    if (lo > 2) out.push("…");
    for (let p = lo; p <= hi; p++) out.push(p);
    if (hi < total - 1) out.push("…");
    out.push(total);
    return out;
}
