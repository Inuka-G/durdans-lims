"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * StatusChip — the one chip for every status/priority/category label.
 * Colour = meaning, identical in light and dark:
 *
 *   neutral   default / informational (queued, received, normal)
 *   pending   amber — waiting on someone (pending, in progress, STAT-ish)
 *   success   emerald — done / verified / collected / paid
 *   danger    red — rejected, failed, critical, overdue
 *   info      brand tint — in transit, dispatched, scheduled
 *
 * Use `dot` for table cells (adds a leading status dot), `size="sm"` in dense rows.
 */
export type ChipTone = "neutral" | "pending" | "success" | "danger" | "info";

const TONE: Record<ChipTone, { chip: string; dot: string }> = {
    neutral: { chip: "bg-surface-muted text-fg-secondary ring-edge", dot: "bg-fg-faint" },
    pending: { chip: "bg-status-pending-bg text-status-pending-fg ring-status-pending-edge", dot: "bg-status-pending" },
    success: { chip: "bg-status-verified-bg text-status-verified-fg ring-status-verified-edge", dot: "bg-status-verified" },
    danger: { chip: "bg-status-danger-bg text-status-danger-fg ring-status-danger-edge", dot: "bg-status-danger" },
    info: { chip: "bg-primary-soft text-primary-strong ring-primary/25", dot: "bg-primary" },
};

export default function StatusChip({
    tone = "neutral",
    children,
    dot = false,
    size = "md",
    title,
    className,
}: {
    tone?: ChipTone;
    children: ReactNode;
    dot?: boolean;
    size?: "sm" | "md";
    title?: string;
    className?: string;
}) {
    const t = TONE[tone];
    return (
        <span
            title={title}
            className={cn(
                "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded font-medium ring-1 ring-inset",
                size === "sm" ? "px-1.5 py-px text-[11px]" : "px-2 py-0.5 text-xs",
                t.chip,
                className
            )}
        >
            {dot && <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />}
            <span className="truncate">{children}</span>
        </span>
    );
}

/* ------------------------------------------------------------------ */
/*  Domain mappings — one place that decides which tone a status gets   */
/* ------------------------------------------------------------------ */

/** Sample / order / result lifecycle statuses used across modules. */
export const STATUS_TONE: Record<string, ChipTone> = {
    // sample lifecycle
    PENDING: "pending",
    SCHEDULED: "neutral",
    COLLECTED: "success",
    IN_TRANSIT: "info",
    SENT: "info",
    RECEIVED: "neutral",
    ACCESSIONED: "neutral",
    IN_PROGRESS: "pending",
    PROCESSING: "pending",
    COMPLETED: "success",
    VERIFIED: "success",
    APPROVED: "success",
    AUTHORIZED: "success",
    AUTHORISED: "success",
    RELEASED: "success",
    DISPATCHED: "info",
    DELIVERED: "success",
    PARTIAL: "pending",
    REJECTED: "danger",
    FAILED: "danger",
    CANCELLED: "danger",
    CRITICAL: "danger",
    ESCALATED: "danger",
    OVERDUE: "danger",
    ACTIVE: "success",
    INACTIVE: "neutral",
    DISABLED: "neutral",
    LOCKED: "danger",
    // billing
    PAID: "success",
    UNPAID: "pending",
    PARTIALLY_PAID: "pending",
    REFUNDED: "neutral",
    DRAFT: "neutral",
    // priority
    STAT: "danger",
    URGENT: "pending",
    NORMAL: "neutral",
    ROUTINE: "neutral",
};

/** "IN_TRANSIT" → "In transit" (sentence case). */
export function humanizeStatus(status: string): string {
    const s = status.replace(/[_-]+/g, " ").trim().toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function toneForStatus(status?: string | null): ChipTone {
    if (!status) return "neutral";
    return STATUS_TONE[status.toUpperCase()] ?? "neutral";
}
