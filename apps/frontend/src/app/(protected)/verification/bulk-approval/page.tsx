"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    AlertTriangle,
    CheckCircle2,
    ClipboardCheck,
    ExternalLink,
    Layers,
    ListChecks,
    RefreshCw,
    Search,
    ShieldCheck,
    X,
} from "lucide-react";
import {
    BulkVerificationBatch,
    BulkVerificationCase,
    bulkApproveTechnically,
    getBulkVerificationWorklist,
} from "@/lib/api";
import { displayResultNo, resultStatusLabel } from "@/lib/result-display";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import KpiTile from "@/components/ui/KpiTile";
import Modal from "@/components/ui/Modal";
import StatusChip, { type ChipTone } from "@/components/ui/StatusChip";
import { InputField, SelectField, TextareaField } from "@/components/ui/Field";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { formatAuditTime } from "@/components/patient-dashboard/dashboard-data";

/** One case flattened with the test group it belongs to — what a card renders. */
type WorklistCase = BulkVerificationCase & {
    batchId: string;
    batchName: string;
    batchCode: string;
    department: string;
};

const ALL_DEPARTMENTS = "All Departments";
const SKELETON_CARDS = 6;

const CHECKBOX_CLASS =
    "h-4 w-4 shrink-0 rounded border-edge-strong accent-primary " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface " +
    "disabled:cursor-not-allowed disabled:opacity-50";

const FLAG_TONE: Record<string, ChipTone> = {
    NORMAL: "neutral",
    LOW: "pending",
    HIGH: "pending",
    CRITICAL_LOW: "danger",
    CRITICAL_HIGH: "danger",
};

const toneForFlag = (flag?: string | null): ChipTone => FLAG_TONE[(flag ?? "").toUpperCase()] ?? "neutral";

const flattenCases = (batches: BulkVerificationBatch[]): WorklistCase[] =>
    batches.flatMap((batch) =>
        (batch.cases ?? []).map((bulkCase) => ({
            ...bulkCase,
            batchId: batch.batchId,
            batchName: batch.batchName,
            batchCode: batch.batchCode,
            department: batch.department,
        }))
    );

const matchesSearch = (item: WorklistCase, query: string) => {
    if (query.length === 0) {
        return true;
    }
    return [
        item.batchName,
        item.batchCode,
        item.patientName,
        item.patientCode,
        item.sampleBarcode,
        item.resultNo,
        displayResultNo(item.resultNo, item.resultId),
    ].some((value) => (value ?? "").toLowerCase().includes(query));
};

export default function BulkApprovalPage() {
    const router = useRouter();
    const [batches, setBatches] = useState<BulkVerificationBatch[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState(ALL_DEPARTMENTS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [supervisorNote, setSupervisorNote] = useState("");

    const loadBulkWorklist = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await getBulkVerificationWorklist();
            setBatches(response);
            setSelectedIds(new Set());
        } catch (loadError) {
            console.error("Failed to load bulk verification worklist", loadError);
            setError("Couldn't load the bulk verification worklist. Retry to try again.");
            setBatches([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadBulkWorklist();
    }, [loadBulkWorklist]);

    const allCases = useMemo(() => flattenCases(batches), [batches]);

    const departments = useMemo(
        () => Array.from(new Set(batches.map((batch) => batch.department))).sort(),
        [batches]
    );

    const visibleCases = useMemo(() => {
        const query = search.trim().toLowerCase();
        return allCases.filter(
            (item) =>
                matchesSearch(item, query) &&
                (department === ALL_DEPARTMENTS || item.department.toLowerCase() === department.toLowerCase())
        );
    }, [allCases, search, department]);

    const safeVisible = useMemo(() => visibleCases.filter((item) => item.safeForApproval), [visibleCases]);
    const heldVisible = useMemo(() => visibleCases.filter((item) => !item.safeForApproval), [visibleCases]);

    // Queue-wide totals for the KPI row
    const queueSafe = allCases.filter((item) => item.safeForApproval).length;
    const queueHeld = allCases.length - queueSafe;

    const selectedCases = useMemo(
        () => allCases.filter((item) => item.safeForApproval && selectedIds.has(item.resultId)),
        [allCases, selectedIds]
    );
    const selectedVisibleCount = safeVisible.filter((item) => selectedIds.has(item.resultId)).length;
    const allVisibleSelected = safeVisible.length > 0 && selectedVisibleCount === safeVisible.length;

    const hasFilters = search.trim() !== "" || department !== ALL_DEPARTMENTS;

    const clearFilters = () => {
        setSearch("");
        setDepartment(ALL_DEPARTMENTS);
    };

    const toggleCase = (resultId: string) => {
        setSelectedIds((previous) => {
            const next = new Set(previous);
            if (next.has(resultId)) {
                next.delete(resultId);
            } else {
                next.add(resultId);
            }
            return next;
        });
    };

    // Deliberately replaces the selection rather than adding to it: a supervisor
    // must never approve a case that the current filters have scrolled off screen.
    const selectAllVisible = () => {
        setSelectedIds(new Set(safeVisible.map((item) => item.resultId)));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const closeConfirm = useCallback(() => {
        setIsConfirming(false);
    }, []);

    const handleApprove = async () => {
        if (selectedCases.length === 0) {
            return;
        }

        try {
            setIsSubmitting(true);

            const outcome = await bulkApproveTechnically({
                resultIds: selectedCases.map((item) => item.resultId),
                status: "TECHNICALLY_VERIFIED",
                mltNotes: "Bulk technically verified by lab supervisor.",
                supervisorNote: supervisorNote.trim() || undefined,
            });

            // The server approves each case in its own transaction and reports every
            // one: a case the QC gate held must not vanish behind a green toast.
            const entries = Object.entries(outcome ?? {});
            const failures = entries.filter(([, status]) => status !== "VERIFIED");
            const approvedCount = entries.length - failures.length;

            setIsConfirming(false);
            setSupervisorNote("");

            if (failures.length === 0) {
                toast.success(
                    `Approved ${approvedCount} ${approvedCount === 1 ? "case" : "cases"} and released them to the pathologist worklist.`
                );
                router.push("/verification/pending");
                return;
            }

            const firstFailure = failures[0][1].replace(/^FAILED:\s*/, "");
            toast.error(
                `Approved ${approvedCount}, but ${failures.length} ${failures.length === 1 ? "case was" : "cases were"} not released: ${firstFailure}`,
                { duration: 10000 }
            );
            await loadBulkWorklist();
        } catch (submitError) {
            console.error("Failed to bulk approve results", submitError);
            toast.error("Failed to bulk approve results. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openCase = (resultId: string) => {
        router.push(`/verification/review/${resultId}`);
    };

    const caseWord = selectedCases.length === 1 ? "case" : "cases";

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                crumbs={[{ label: "Verification", href: "/verification/pending" }, { label: "Bulk approval" }]}
                title="Bulk technical approval"
                meta={
                    <>
                        <span>Approve every in-range case in one click; exceptions stay held for case-by-case review.</span>
                        <span aria-hidden="true">·</span>
                        <span>Lab supervisor</span>
                    </>
                }
                actions={
                    <Button icon={RefreshCw} onClick={() => void loadBulkWorklist()} loading={loading}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? "Loading bulk verification worklist"
                    : error
                      ? "Bulk verification worklist failed to load"
                      : `Showing ${visibleCases.length} of ${allCases.length} cases. ${selectedCases.length} selected.`}
            </p>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile
                    label="Test groups"
                    value={batches.length}
                    icon={Layers}
                    loading={loading}
                    note={`${allCases.length} ${allCases.length === 1 ? "case" : "cases"} in the queue`}
                />
                <KpiTile
                    label="Safe for instant approval"
                    value={queueSafe}
                    icon={ShieldCheck}
                    tone="success"
                    loading={loading}
                    note="Every parameter within range"
                />
                <KpiTile
                    label="Review mixed / exceptions"
                    value={queueHeld}
                    icon={AlertTriangle}
                    tone={queueHeld > 0 ? "warning" : "neutral"}
                    loading={loading}
                    note="Abnormal or critical findings"
                />
                <KpiTile
                    label="Selected for approval"
                    value={selectedCases.length}
                    icon={ClipboardCheck}
                    loading={loading}
                    note={selectedCases.length > 0 ? "Ready to approve" : "Pick safe cases below"}
                />
            </div>

            {/* Filter toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-surface-muted px-3 py-2">
                <InputField
                    label="Search cases"
                    hideLabel
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search test group, patient, patient code, specimen or result ID"
                    autoComplete="off"
                    className="min-w-[220px] flex-1 sm:max-w-md"
                />
                <SelectField
                    label="Department"
                    hideLabel
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className="w-full sm:w-48"
                >
                    <option value={ALL_DEPARTMENTS}>All departments</option>
                    {departments.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </SelectField>
                {hasFilters && (
                    <Button variant="ghost" icon={X} onClick={clearFilters}>
                        Clear filters
                    </Button>
                )}
                <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-fg-secondary">
                    <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={() => (allVisibleSelected ? clearSelection() : selectAllVisible())}
                        disabled={loading || safeVisible.length === 0}
                        aria-label="Select all safe cases shown"
                        className={CHECKBOX_CLASS}
                    />
                    <span>
                        Select all safe ({safeVisible.length})
                    </span>
                </label>
            </div>

            {loading ? (
                <div aria-hidden="true" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: SKELETON_CARDS }).map((_, index) => (
                        <div key={index} className="rounded-lg border border-edge bg-surface p-4">
                            <span className="block h-4 w-40 rounded bg-skeleton" />
                            <span className="mt-2 block h-3 w-28 rounded bg-skeleton" />
                            <span className="mt-4 block h-3 w-full rounded bg-skeleton" />
                            <span className="mt-2 block h-3 w-3/4 rounded bg-skeleton" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="rounded-lg border border-edge bg-surface">
                    <EmptyState
                        icon={AlertTriangle}
                        title="Worklist unavailable"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => void loadBulkWorklist()}>
                                Retry
                            </Button>
                        }
                    />
                </div>
            ) : visibleCases.length === 0 ? (
                <div className="rounded-lg border border-edge bg-surface">
                    {hasFilters ? (
                        <EmptyState
                            icon={Search}
                            title="No cases match"
                            description="Try a different search term or department."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={ShieldCheck}
                            title="No cases waiting"
                            description="Cases waiting for technical verification will appear here, grouped as safe or held for review."
                        />
                    )}
                </div>
            ) : (
                <div className="space-y-6 pb-24">
                    {/* Safe cases — one click approves them all */}
                    <SectionCard
                        title="Safe for instant approval"
                        count={safeVisible.length}
                        actions={
                            safeVisible.length > 0 ? (
                                <Button size="sm" icon={ListChecks} onClick={selectAllVisible} disabled={allVisibleSelected}>
                                    Select all
                                </Button>
                            ) : undefined
                        }
                    >
                        {safeVisible.length === 0 ? (
                            <p className="text-sm text-fg-muted">No fully in-range cases match the current filters.</p>
                        ) : (
                            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {safeVisible.map((item) => (
                                    <li key={item.resultId}>
                                        <CaseCard
                                            item={item}
                                            selected={selectedIds.has(item.resultId)}
                                            onToggle={() => toggleCase(item.resultId)}
                                            onOpen={() => openCase(item.resultId)}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>

                    {/* Held cases — each opens in the single-case review */}
                    <SectionCard title="Review mixed / exceptions" count={heldVisible.length}>
                        {heldVisible.length === 0 ? (
                            <p className="text-sm text-fg-muted">No held cases match the current filters.</p>
                        ) : (
                            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {heldVisible.map((item) => (
                                    <li key={item.resultId}>
                                        <CaseCard item={item} onOpen={() => openCase(item.resultId)} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>
                </div>
            )}

            {/* Floating bulk action bar — appears once a case is selected */}
            {selectedCases.length > 0 && (
                <section
                    aria-label="Selection summary"
                    className="sticky bottom-0 z-20 mt-4 rounded-lg border border-edge bg-surface p-3 shadow-lg sm:p-4"
                >
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        <dl className="flex flex-wrap gap-x-6 gap-y-2">
                            <div>
                                <dt className="text-xs text-fg-muted">Selected cases</dt>
                                <dd className="text-base font-semibold tabular-nums text-status-verified-fg">
                                    {selectedCases.length}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-fg-muted">Test groups</dt>
                                <dd className="text-base font-semibold tabular-nums text-fg">
                                    {new Set(selectedCases.map((item) => item.batchId)).size}
                                </dd>
                            </div>
                        </dl>

                        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                            <Button onClick={clearSelection} disabled={isSubmitting}>
                                Clear selection
                            </Button>
                            <Button
                                variant="primary"
                                icon={CheckCircle2}
                                onClick={() => setIsConfirming(true)}
                                disabled={isSubmitting}
                            >
                                Approve {selectedCases.length} {caseWord}
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            <Modal
                open={isConfirming}
                onClose={closeConfirm}
                dismissible={!isSubmitting}
                title={`Approve ${selectedCases.length} safe ${caseWord}?`}
                description="Every parameter on these specimens is within its reference range. Each case will be marked technically verified under your name and released to the pathologist worklist."
                footer={
                    <>
                        <Button onClick={closeConfirm} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button variant="primary" icon={CheckCircle2} onClick={handleApprove} loading={isSubmitting}>
                            {isSubmitting ? "Approving…" : "Confirm approval"}
                        </Button>
                    </>
                }
            >
                <ul className="mb-4 max-h-40 divide-y divide-edge overflow-y-auto rounded-md border border-edge bg-surface-muted text-xs">
                    {selectedCases.map((item) => (
                        <li key={item.resultId} className="flex items-center justify-between gap-3 px-3 py-1.5">
                            <span className="min-w-0 truncate font-medium text-fg">
                                {item.patientName || "Unknown patient"}
                                <span className="font-normal text-fg-muted"> · {item.batchName}</span>
                            </span>
                            <span className="shrink-0 font-mono text-fg-secondary">
                                {displayResultNo(item.resultNo, item.resultId)}
                            </span>
                        </li>
                    ))}
                </ul>
                <TextareaField
                    id="supervisor-note"
                    label="Supervisor remark"
                    hint="Optional. Recorded against every case in this batch, e.g. run and controls reviewed."
                    rows={3}
                    value={supervisorNote}
                    onChange={(event) => setSupervisorNote(event.target.value)}
                    placeholder="Run and controls reviewed"
                    disabled={isSubmitting}
                />
            </Modal>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Card                                                                */
/* ------------------------------------------------------------------ */

function CaseCard({
    item,
    selected,
    onToggle,
    onOpen,
}: {
    item: WorklistCase;
    selected?: boolean;
    onToggle?: () => void;
    onOpen: () => void;
}) {
    const selectable = item.safeForApproval && Boolean(onToggle);
    const displayId = displayResultNo(item.resultNo, item.resultId);
    const critical = Boolean(item.hasCriticalFinding);
    const hiddenParameters = Math.max(0, item.parameterCount - item.parameters.length);

    return (
        <article
            onClick={() => selectable && onToggle?.()}
            className={cn(
                "flex h-full flex-col gap-3 rounded-lg border p-4 transition-colors",
                selectable ? "cursor-pointer" : "cursor-default",
                selected
                    ? "border-primary bg-primary-soft"
                    : critical
                      ? "border-status-danger-edge bg-status-danger-bg"
                      : "border-edge bg-surface hover:bg-surface-hover"
            )}
            aria-label={`${item.batchName} for ${item.patientName || "unknown patient"}`}
        >
            <header className="flex items-start gap-3">
                {selectable && (
                    <input
                        type="checkbox"
                        checked={Boolean(selected)}
                        onChange={() => onToggle?.()}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${displayId}`}
                        className={cn("mt-0.5", CHECKBOX_CLASS)}
                    />
                )}
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg" title={item.batchName}>
                        {item.batchName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-fg-muted">
                        <span className="font-mono">{displayId}</span>
                        {item.sampleBarcode && (
                            <>
                                <span aria-hidden="true"> · </span>
                                <span className="font-mono" title="Specimen barcode">
                                    {item.sampleBarcode}
                                </span>
                            </>
                        )}
                    </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    <PriorityBadge priority={item.priorityLevel ?? ""} />
                    {item.status === "RETURNED_FOR_RECHECK" && (
                        <StatusChip tone="pending" size="sm" dot>
                            {resultStatusLabel(item.status)}
                        </StatusChip>
                    )}
                </div>
            </header>

            <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg" title={item.patientName || undefined}>
                    {item.patientName || "Unknown patient"}
                </p>
                {item.patientCode && (
                    <p className="truncate font-mono text-xs text-fg-muted">{item.patientCode}</p>
                )}
            </div>

            {item.parameters.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Parameter preview">
                    {item.parameters.map((parameter, index) => (
                        <li key={`${parameter.parameterName ?? "p"}-${index}`}>
                            <StatusChip tone={toneForFlag(parameter.flag)} size="sm">
                                <span className="font-medium">{parameter.parameterName ?? "—"}</span>
                                <span className="tabular-nums"> {parameter.resultValue ?? "—"}</span>
                                {parameter.unit && <span className="text-fg-muted"> {parameter.unit}</span>}
                            </StatusChip>
                        </li>
                    ))}
                    {hiddenParameters > 0 && (
                        <li>
                            <StatusChip tone="neutral" size="sm">
                                +{hiddenParameters} more
                            </StatusChip>
                        </li>
                    )}
                </ul>
            )}

            <footer className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-fg-muted">
                <span>
                    {item.updatedAt ? (
                        <>
                            Updated <time dateTime={item.updatedAt}>{formatAuditTime(item.updatedAt)}</time>
                        </>
                    ) : (
                        <span className="text-fg-faint">—</span>
                    )}
                </span>
                {item.safeForApproval ? (
                    <StatusChip tone="success" size="sm" dot>
                        Safe
                    </StatusChip>
                ) : (
                    <Button
                        size="sm"
                        variant="primary"
                        icon={ExternalLink}
                        onClick={(event) => {
                            event.stopPropagation();
                            onOpen();
                        }}
                        aria-label={`Review exception ${displayId}`}
                    >
                        Review exception
                    </Button>
                )}
            </footer>
        </article>
    );
}
