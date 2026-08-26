"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
    value: T;
    label: string;
    /** Optional count rendered after the label (e.g. tab with pending count). */
    count?: number;
};

/**
 * SegmentedControl — a radio group that looks like a pill bar.
 * Implements the APG radio-group keyboard pattern: one Tab stop (the
 * selected segment), Arrow/Home/End move and select.
 */
export default function SegmentedControl<T extends string>({
    value,
    onChange,
    options,
    ariaLabel,
    size = "md",
    className,
}: {
    value: T;
    onChange: (next: T) => void;
    options: SegmentOption<T>[];
    ariaLabel: string;
    size?: "sm" | "md";
    className?: string;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const activeIndex = Math.max(
        0,
        options.findIndex((o) => o.value === value)
    );

    const select = (index: number) => {
        const next = options[(index + options.length) % options.length];
        if (!next) return;
        onChange(next.value);
        refs.current[(index + options.length) % options.length]?.focus();
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        switch (e.key) {
            case "ArrowRight":
            case "ArrowDown":
                e.preventDefault();
                select(activeIndex + 1);
                break;
            case "ArrowLeft":
            case "ArrowUp":
                e.preventDefault();
                select(activeIndex - 1);
                break;
            case "Home":
                e.preventDefault();
                select(0);
                break;
            case "End":
                e.preventDefault();
                select(options.length - 1);
                break;
        }
    };

    return (
        <div
            role="radiogroup"
            aria-label={ariaLabel}
            onKeyDown={onKeyDown}
            className={cn(
                "no-scrollbar inline-flex max-w-full items-center overflow-x-auto rounded-md border border-edge bg-surface-muted p-0.5",
                className
            )}
        >
            {options.map((opt, i) => {
                const active = i === activeIndex;
                return (
                    <button
                        key={opt.value}
                        ref={(el) => {
                            refs.current[i] = el;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onChange(opt.value)}
                        className={cn(
                            "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
                            active
                                ? "bg-surface text-fg shadow-[0_1px_0_rgba(15,23,42,0.06)] ring-1 ring-edge"
                                : "text-fg-muted hover:text-fg"
                        )}
                    >
                        {opt.label}
                        {opt.count !== undefined && (
                            <span
                                className={cn(
                                    "rounded-full px-1.5 text-[12px] tabular-nums",
                                    active ? "bg-surface-hover text-fg-secondary" : "bg-edge text-fg-secondary"
                                )}
                            >
                                {opt.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
