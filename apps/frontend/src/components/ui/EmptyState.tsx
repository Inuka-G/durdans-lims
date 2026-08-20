"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — an invitation, not an apology. Headline names the space,
 * one line explains it, an optional action tells the user what to do next.
 */
export default function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    compact = false,
    className,
}: {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
    compact?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center",
                compact ? "gap-1 py-6" : "gap-2 py-10",
                className
            )}
        >
            <Icon className="h-6 w-6 text-fg-faint" aria-hidden="true" />
            <p className="text-sm font-medium text-fg-secondary">{title}</p>
            {description && <p className="max-w-xs text-xs text-fg-muted">{description}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}
