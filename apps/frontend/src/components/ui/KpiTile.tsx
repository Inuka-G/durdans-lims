"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, ArrowRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KpiTile — one fixed anatomy for every dashboard number:
 *
 *   [icon] Label                       ← 12px secondary
 *   Value                              ← 26px tabular
 *   Context line (delta | link | note) ← 12px
 *
 * Every tile uses the same three rows so the eye can scan a row of four
 * without re-learning where things live. Colour is reserved for status
 * (tone) — never decoration; a delta is informational, so it stays neutral.
 */

export type KpiTone = "neutral" | "warning" | "danger" | "success";

export type KpiDelta = {
    /** Signed percentage or absolute change. 0 renders as "no change". */
    value: number;
    /** "%" appends a percent sign; "abs" renders the raw number. */
    unit?: "%" | "abs";
    /** e.g. "vs yesterday" */
    label: string;
};

type BaseProps = {
    label: string;
    value: string | number | null | undefined;
    icon: LucideIcon;
    tone?: KpiTone;
    loading?: boolean;
    className?: string;
};

/** Static tile: context line is a delta (preferred when both are given) or a note. */
type StaticProps = BaseProps & {
    delta?: KpiDelta;
    note?: string;
    href?: undefined;
    onClick?: undefined;
    linkLabel?: undefined;
};

/** Link tile: the whole tile navigates; context line becomes "<linkLabel> →". */
type LinkProps = BaseProps & {
    href: string;
    linkLabel: string;
    onClick?: undefined;
    delta?: undefined;
    note?: undefined;
};

/** Button tile: the whole tile triggers an in-page action. */
type ButtonProps = BaseProps & {
    onClick: () => void;
    linkLabel: string;
    href?: undefined;
    delta?: undefined;
    note?: undefined;
};

export type KpiTileProps = StaticProps | LinkProps | ButtonProps;

const TONE: Record<KpiTone, { value: string; bar: string; icon: string }> = {
    neutral: { value: "text-fg", bar: "", icon: "text-fg-faint" },
    warning: { value: "text-status-pending-fg", bar: "bg-status-pending", icon: "text-status-pending-fg" },
    danger: { value: "text-status-danger-fg", bar: "bg-status-danger", icon: "text-status-danger-fg" },
    success: { value: "text-status-verified-fg", bar: "bg-status-verified", icon: "text-status-verified-fg" },
};

function DeltaLine({ delta }: { delta: KpiDelta }) {
    const { value, unit = "%", label } = delta;
    if (value === 0) {
        return (
            <span className="inline-flex items-center gap-1 text-fg-muted">
                <Minus className="h-3 w-3 shrink-0" aria-hidden="true" />
                No change {label}
            </span>
        );
    }
    const up = value > 0;
    const formatted = `${Math.abs(value)}${unit === "%" ? "%" : ""}`;
    return (
        <span className="inline-flex items-center gap-1 text-fg-secondary">
            {up ? (
                <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
                <ArrowDownRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            <span className="sr-only">{up ? "Up" : "Down"} </span>
            {formatted} {label}
        </span>
    );
}

export default function KpiTile(props: KpiTileProps) {
    const { label, value, icon: Icon, tone = "neutral", loading, className } = props;
    const t = TONE[tone];
    const interactive = !!props.href || !!props.onClick;

    const context = loading ? (
        <span className="inline-block h-3 w-24 rounded bg-skeleton" aria-hidden="true" />
    ) : interactive ? (
        <span className="inline-flex items-center gap-1 font-medium text-primary-strong group-hover:underline">
            {props.linkLabel}
            <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        </span>
    ) : props.delta ? (
        <DeltaLine delta={props.delta} />
    ) : props.note ? (
        <span className="text-fg-muted">{props.note}</span>
    ) : (
        <span aria-hidden="true">&nbsp;</span>
    );

    // Spans only: a <button> may contain phrasing content, not <div>s.
    const body = (
        <>
            {t.bar && <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[3px]", t.bar)} />}
            <span className="flex items-center gap-2 text-xs font-medium text-fg-muted">
                <Icon className={cn("h-4 w-4 shrink-0", t.icon)} aria-hidden="true" />
                <span className="truncate">{label}</span>
            </span>
            <span className={cn("mt-1.5 block text-[26px] font-semibold leading-none tabular-nums", t.value)}>
                {loading ? (
                    <span className="inline-block h-7 w-12 rounded bg-skeleton align-middle" aria-hidden="true" />
                ) : value === null || value === undefined ? (
                    <span className="text-fg-faint">—</span>
                ) : (
                    value
                )}
            </span>
            <span className="mt-2 block min-h-4 text-xs leading-4">{context}</span>
        </>
    );

    const baseClass = cn(
        "group relative block overflow-hidden rounded-lg border border-edge bg-surface px-4 py-3.5",
        t.bar && "pl-[19px]",
        interactive &&
            "transition-colors hover:border-edge-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-canvas",
        className
    );

    const ariaLabel = interactive ? `${label}: ${value ?? "—"}. ${props.linkLabel}` : undefined;

    if (props.href) {
        return (
            <Link href={props.href} className={baseClass} aria-label={ariaLabel}>
                {body}
            </Link>
        );
    }
    if (props.onClick) {
        return (
            <button type="button" onClick={props.onClick} className={cn(baseClass, "w-full text-left")} aria-label={ariaLabel}>
                {body}
            </button>
        );
    }
    return <div className={baseClass}>{body}</div>;
}
