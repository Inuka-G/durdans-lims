"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, Plus } from "lucide-react";
import { getPatientOrders } from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { formatRegistered } from "@/components/patient-dashboard/dashboard-data";
import { usePatient } from "../../PatientProvider";

const PAGE_SIZE = 50;

type PatientOrderRow = {
    id: string;
    orderId: string;
    orderDate?: string | null;
    status?: string | null;
    paymentStatus?: string | null;
    tests?: Array<{
        testCode?: string | null;
        testName?: string | null;
    }>;
};

/* ------------------------------------------------------------------ */
/*  Status chips — colour = meaning, everything else neutral            */
/* ------------------------------------------------------------------ */

type ChipTone = "neutral" | "pending" | "verified" | "danger";

const CHIP_TONE: Record<ChipTone, { chip: string; dot: string }> = {
    neutral: { chip: "bg-surface-muted text-fg-secondary ring-edge", dot: "bg-fg-faint" },
    pending: { chip: "bg-status-pending-bg text-status-pending-fg ring-status-pending-edge", dot: "bg-status-pending" },
    verified: { chip: "bg-status-verified-bg text-status-verified-fg ring-status-verified-edge", dot: "bg-status-verified" },
    danger: { chip: "bg-status-danger-bg text-status-danger-fg ring-status-danger-edge", dot: "bg-status-danger" },
};

const ORDER_STATUS_TONE: Record<string, ChipTone> = {
    PENDING: "pending",
    IN_PROGRESS: "neutral",
    SAMPLE_COLLECTED: "neutral",
    COMPLETED: "verified",
    CANCELLED: "danger",
    REJECTED: "danger",
};

const PAYMENT_STATUS_TONE: Record<string, ChipTone> = {
    PAID: "verified",
    PENDING: "pending",
    FAILED: "danger",
    REFUNDED: "neutral",
};

function StatusChip({ label, tone }: { label: string; tone: ChipTone }) {
    const t = CHIP_TONE[tone];
    return (
        <span
            title={label}
            className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                t.chip
            )}
        >
            <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />
            <span className="truncate">{label}</span>
        </span>
    );
}

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

/** "IN_PROGRESS" → "In progress" */
const formatLabel = (value?: string | null) => {
    if (!value) return "—";
    const words = value.replace(/_/g, " ").trim().toLowerCase();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : "—";
};

const formatOrderDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return formatRegistered(date);
};

const testsSummary = (tests: PatientOrderRow["tests"]) => {
    const names = (tests ?? []).map((test) => test.testName || test.testCode || "Unknown test");
    if (names.length === 0) return { text: "No tests listed", title: "", count: 0 };
    const shown = names.slice(0, 2).join(", ");
    const rest = names.length - 2;
    return {
        text: rest > 0 ? `${shown} +${rest} more` : shown,
        title: names.join(", "),
        count: names.length,
    };
};

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function PatientOrdersTab() {
    const { patient } = usePatient();
    const [orders, setOrders] = useState<PatientOrderRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState<number | null>(null);

    const patientCode = patient?.patientCode || patient?.id;

    const loadOrders = useCallback(
        async (pageIndex: number, isActive: () => boolean) => {
            if (!patientCode) {
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                setError("");
                const response = await getPatientOrders(patientCode, pageIndex, PAGE_SIZE);
                if (!isActive()) return;
                const content: PatientOrderRow[] = response?.content ?? [];
                setOrders(content);
                setTotalPages(typeof response?.totalPages === "number" && response.totalPages > 0 ? response.totalPages : 1);
                setTotalElements(typeof response?.totalElements === "number" ? response.totalElements : null);
            } catch (loadError) {
                console.error("Failed to load patient orders", loadError);
                if (isActive()) setError("Could not load this patient's orders.");
            } finally {
                if (isActive()) setLoading(false);
            }
        },
        [patientCode]
    );

    useEffect(() => {
        let active = true;
        void loadOrders(page, () => active);
        return () => {
            active = false;
        };
    }, [loadOrders, page]);

    if (!patient) return null;

    const hasPrev = page > 0;
    const hasNext = page + 1 < totalPages;
    const shownCount = orders.length;
    const totalCount = totalElements ?? shownCount;

    return (
        <SectionCard
            title="Orders"
            count={!loading && !error ? totalCount : undefined}
            flush
            className="mb-8"
            actions={
                <Button size="sm" variant="primary" icon={Plus} href="/orders-billing/create-order">
                    Create order
                </Button>
            }
        >
            {/* States live outside the table so they centre on small screens */}
            {loading ? (
                <div role="status" aria-live="polite">
                    <span className="sr-only">Loading orders</span>
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-20 rounded bg-skeleton" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton sm:block" />
                                <span className="h-3 w-40 rounded bg-skeleton" />
                                <span className="ml-auto hidden h-3 w-16 rounded bg-skeleton md:block" />
                                <span className="h-4 w-16 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : error ? (
                <div role="alert">
                    <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load orders"
                        description={error}
                        compact
                        action={
                            <Button size="sm" onClick={() => void loadOrders(page, () => true)}>
                                Retry
                            </Button>
                        }
                    />
                </div>
            ) : orders.length === 0 ? (
                <EmptyState
                    icon={ClipboardList}
                    title="No orders yet"
                    description="Create the first test order for this patient."
                    compact
                    action={
                        <Button size="sm" icon={Plus} href="/orders-billing/create-order">
                            Create order
                        </Button>
                    }
                />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] table-fixed text-left text-[13px]">
                        <thead>
                            <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                {/* Percentages sum to 94% so the 40px chevron column fits at the 760px minimum */}
                                <th scope="col" className="w-[15%] py-2 pl-4 pr-3 font-medium">Order no</th>
                                <th scope="col" className="w-[15%] px-3 py-2 font-medium">Date</th>
                                <th scope="col" className="w-[32%] px-3 py-2 font-medium">Tests</th>
                                <th scope="col" className="w-[19%] px-3 py-2 font-medium">Status</th>
                                <th scope="col" className="w-[13%] px-3 py-2 font-medium">Payment</th>
                                <th scope="col" className="w-10 py-2 pl-2 pr-3">
                                    <span className="sr-only">Open</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-edge whitespace-nowrap">
                            {orders.map((order) => {
                                const href = `/orders-billing/orders/${order.id}`;
                                const summary = testsSummary(order.tests);
                                const status = (order.status ?? "").toUpperCase();
                                const payment = (order.paymentStatus ?? "PENDING").toUpperCase();
                                return (
                                    <tr key={order.id} className="group transition-colors hover:bg-surface-hover">
                                        <td className="truncate py-2 pl-4 pr-3">
                                            <Link
                                                href={href}
                                                className="rounded font-mono text-xs font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                            >
                                                {order.orderId || order.id}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2 tabular-nums text-fg-secondary">{formatOrderDate(order.orderDate)}</td>
                                        <td className="px-3 py-2 text-fg-secondary">
                                            <span className="block truncate" title={summary.title || undefined}>
                                                {summary.count > 0 && (
                                                    <span className="tabular-nums text-fg-muted">
                                                        {summary.count} {summary.count === 1 ? "test" : "tests"}
                                                        <span className="text-fg-faint"> · </span>
                                                    </span>
                                                )}
                                                {summary.count > 0 ? summary.text : <span className="text-fg-muted">{summary.text}</span>}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <StatusChip label={formatLabel(status)} tone={ORDER_STATUS_TONE[status] ?? "neutral"} />
                                        </td>
                                        <td className="px-3 py-2">
                                            <StatusChip label={formatLabel(payment)} tone={PAYMENT_STATUS_TONE[payment] ?? "neutral"} />
                                        </td>
                                        <td className="py-2 pl-2 pr-3 text-right">
                                            <Link
                                                href={href}
                                                aria-label={`Open order ${order.orderId || order.id}`}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover:text-fg-muted"
                                            >
                                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Footer — stays mounted while a page loads so the focused Next/Previous button is not unmounted */}
            {!error && (orders.length > 0 || (loading && page > 0)) && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge px-4 py-2 text-xs text-fg-muted">
                    <span className="tabular-nums" aria-live="polite">
                        Showing {shownCount} of {totalCount} {totalCount === 1 ? "order" : "orders"}
                    </span>
                    {totalPages > 1 && (
                        <nav aria-label="Orders pagination" className="flex items-center gap-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                icon={ChevronLeft}
                                aria-label="Previous page"
                                disabled={!hasPrev || loading}
                                onClick={() => setPage((current) => Math.max(0, current - 1))}
                            >
                                Previous
                            </Button>
                            <span className="px-1 tabular-nums">
                                Page {page + 1} of {totalPages}
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                aria-label="Next page"
                                disabled={!hasNext || loading}
                                onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                            >
                                Next
                                <ChevronRight aria-hidden="true" />
                            </Button>
                        </nav>
                    )}
                </div>
            )}
        </SectionCard>
    );
}
