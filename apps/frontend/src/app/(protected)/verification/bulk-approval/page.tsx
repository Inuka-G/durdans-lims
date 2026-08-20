"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    AlertTriangle,
    CheckCircle2,
    ClipboardCheck,
    Layers,
    ListChecks,
    RefreshCw,
    Search,
    ShieldCheck,
    X,
} from "lucide-react";
import {
    BulkVerificationBatch,
    bulkApproveTechnically,
    getBulkVerificationWorklist,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import KpiTile from "@/components/ui/KpiTile";
import Modal from "@/components/ui/Modal";
import StatusChip from "@/components/ui/StatusChip";
import { InputField, SelectField, TextareaField } from "@/components/ui/Field";
import { formatAuditTime } from "@/components/patient-dashboard/dashboard-data";

type SelectableBatch = BulkVerificationBatch & {
    isSelected: boolean;
};

const ALL_DEPARTMENTS = "All Departments";
const SKELETON_ROWS = 6;

const CHECKBOX_CLASS =
    "h-4 w-4 shrink-0 rounded border-edge-strong accent-primary " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface " +
    "disabled:cursor-not-allowed disabled:opacity-50";

export default function BulkApprovalPage() {
    const router = useRouter();
    const [batches, setBatches] = useState<SelectableBatch[]>([]);
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState(ALL_DEPARTMENTS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [supervisorNote, setSupervisorNote] = useState("");
    const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

    const loadBulkWorklist = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await getBulkVerificationWorklist();
            setBatches(response.map((batch) => ({ ...batch, isSelected: false })));
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

    const filteredBatches = useMemo(() => {
        return batches.filter((batch) => {
            const matchesSearch =
                search.trim() === "" ||
                batch.batchName.toLowerCase().includes(search.toLowerCase()) ||
                batch.batchCode.toLowerCase().includes(search.toLowerCase());

            const matchesDept =
                department === ALL_DEPARTMENTS ||
                batch.department.toLowerCase() === department.toLowerCase();

            return matchesSearch && matchesDept;
        });
    }, [batches, search, department]);

    const departments = useMemo(
        () => Array.from(new Set(batches.map((batch) => batch.department))),
        [batches]
    );

    const selectedBatches = batches.filter((batch) => batch.isSelected);
    const selectedResultIds = selectedBatches.flatMap((batch) => batch.resultIds);
    const totalSafeForApproval = selectedBatches.reduce(
        (sum, batch) => sum + batch.safeForApproval,
        0
    );
    const totalExceptions = selectedBatches.reduce(
        (sum, batch) => sum + batch.exceptions,
        0
    );

    // Queue-wide totals for the KPI row
    const queueSafe = batches.reduce((sum, batch) => sum + batch.safeForApproval, 0);
    const queueTotal = batches.reduce((sum, batch) => sum + batch.totalResults, 0);
    const queueHeld = batches.reduce((sum, batch) => sum + batch.exceptions, 0);
    const queueSafePercent =
        batches.length === 0 ? 0 : Math.min(100, Math.round((queueSafe / Math.max(1, queueTotal)) * 100));

    // Header checkbox state (visible, selectable groups only)
    const selectableVisible = filteredBatches.filter((batch) => batch.safeForApproval > 0);
    const selectedVisibleCount = selectableVisible.filter((batch) => batch.isSelected).length;
    const allVisibleSelected =
        selectableVisible.length > 0 && selectedVisibleCount === selectableVisible.length;
    const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

    useEffect(() => {
        if (headerCheckboxRef.current) {
            headerCheckboxRef.current.indeterminate = someVisibleSelected;
        }
    }, [someVisibleSelected]);

    const hasFilters = search.trim() !== "" || department !== ALL_DEPARTMENTS;

    const clearFilters = () => {
        setSearch("");
        setDepartment(ALL_DEPARTMENTS);
    };

    const toggleBatch = (id: string) => {
        setBatches((previous) =>
            previous.map((batch) =>
                batch.batchId === id && batch.safeForApproval > 0
                    ? { ...batch, isSelected: !batch.isSelected }
                    : batch
            )
        );
    };

    const selectAll = () => {
        setBatches((previous) =>
            previous.map((batch) => ({
                ...batch,
                isSelected:
                    batch.safeForApproval > 0 &&
                    filteredBatches.some((visibleBatch) => visibleBatch.batchId === batch.batchId),
            }))
        );
    };

    const clearSelection = () => {
        setBatches((previous) => previous.map((batch) => ({ ...batch, isSelected: false })));
    };

    const closeConfirm = useCallback(() => {
        setIsConfirming(false);
    }, []);

    const handleApprove = async () => {
        if (selectedResultIds.length === 0) {
            return;
        }

        try {
            setIsSubmitting(true);

            await bulkApproveTechnically({
                resultIds: selectedResultIds,
                status: "TECHNICALLY_VERIFIED",
                mltNotes: "Bulk technically verified by lab supervisor.",
                supervisorNote: supervisorNote.trim() || undefined,
            });

            setIsConfirming(false);
            setSupervisorNote("");
            router.push("/verification/pending");
        } catch (submitError) {
            console.error("Failed to bulk approve results", submitError);
            toast.error("Failed to bulk approve results. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReviewCases = (reviewResultIds: string[]) => {
        if (reviewResultIds.length === 0) {
            return;
        }

        router.push(`/verification/review/${reviewResultIds[0]}`);
    };

    const caseWord = selectedResultIds.length === 1 ? "case" : "cases";
    const groupWord = selectedBatches.length === 1 ? "group" : "groups";

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                crumbs={[{ label: "Verification", href: "/verification/pending" }, { label: "Bulk approval" }]}
                title="Bulk technical verification"
                meta={
                    <>
                        <span>Approve safe result groups while holding exceptions for case-by-case review.</span>
                        <span aria-hidden="true">·</span>
                        <span>Lab supervisor</span>
                        <span aria-hidden="true">·</span>
                        <span>Verification queue</span>
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
                      : `Showing ${filteredBatches.length} of ${batches.length} test groups. ${selectedBatches.length} ${groupWord} selected.`}
            </p>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile
                    label="Test groups"
                    value={batches.length}
                    icon={Layers}
                    loading={loading}
                    note={`${filteredBatches.length} shown`}
                />
                <KpiTile
                    label="Safe results ready"
                    value={queueSafe}
                    icon={ShieldCheck}
                    tone="success"
                    loading={loading}
                    note={`${queueSafePercent}% of ${queueTotal} results`}
                />
                <KpiTile
                    label="Held for review"
                    value={queueHeld}
                    icon={AlertTriangle}
                    tone={queueHeld > 0 ? "warning" : "neutral"}
                    loading={loading}
                    note="Needs case-by-case review"
                />
                <KpiTile
                    label="Selected for approval"
                    value={totalSafeForApproval}
                    icon={ClipboardCheck}
                    loading={loading}
                    note={`${selectedBatches.length} ${groupWord} selected`}
                />
            </div>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <SectionCard title="Test groups" count={loading ? undefined : filteredBatches.length} flush>
                    {/* Filter toolbar */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                        <InputField
                            label="Search test groups"
                            hideLabel
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search test group or code"
                            autoComplete="off"
                            className="min-w-[180px] flex-1 sm:max-w-xs"
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
                        <Button
                            icon={ListChecks}
                            onClick={selectAll}
                            disabled={loading || selectableVisible.length === 0}
                            className="sm:ml-auto"
                        >
                            Select safe groups
                        </Button>
                    </div>

                    {/* States live outside the table so they centre on small screens */}
                    {loading ? (
                        <ul aria-hidden="true" className="divide-y divide-edge">
                            {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                                <li key={index} className="flex items-center gap-3 px-4 py-2.5">
                                    <span className="h-4 w-4 shrink-0 rounded bg-skeleton" />
                                    <span className="h-3 w-40 rounded bg-skeleton" />
                                    <span className="hidden h-3 w-24 rounded bg-skeleton md:block" />
                                    <span className="h-3 w-10 rounded bg-skeleton" />
                                    <span className="h-3 w-10 rounded bg-skeleton" />
                                    <span className="hidden h-4 w-20 rounded bg-skeleton sm:block" />
                                    <span className="ml-auto hidden h-3 w-24 rounded bg-skeleton lg:block" />
                                </li>
                            ))}
                        </ul>
                    ) : error ? (
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
                    ) : filteredBatches.length === 0 ? (
                        hasFilters ? (
                            <EmptyState
                                icon={Search}
                                title="No test groups match"
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
                                title="No test groups ready"
                                description="Result groups waiting for technical verification will appear here."
                            />
                        )
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] table-fixed text-left text-[13px] md:min-w-[810px] lg:min-w-[940px]">
                                <caption className="sr-only">Test groups ready for bulk technical verification</caption>
                                <thead>
                                    <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                        <th scope="col" className="w-10 py-2 pl-4 pr-2">
                                            <input
                                                ref={headerCheckboxRef}
                                                type="checkbox"
                                                aria-label="Select all safe groups"
                                                checked={allVisibleSelected}
                                                onChange={() => (allVisibleSelected ? clearSelection() : selectAll())}
                                                disabled={selectableVisible.length === 0}
                                                className={CHECKBOX_CLASS}
                                            />
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-medium">
                                            Test group
                                        </th>
                                        <th scope="col" className="hidden w-36 px-3 py-2 font-medium md:table-cell">
                                            Department
                                        </th>
                                        <th scope="col" className="w-16 px-3 py-2 text-right font-medium">
                                            Total
                                        </th>
                                        <th scope="col" className="w-16 px-3 py-2 text-right font-medium">
                                            Safe
                                        </th>
                                        <th scope="col" className="w-16 px-3 py-2 text-right font-medium">
                                            Held
                                        </th>
                                        <th scope="col" className="w-32 px-3 py-2 font-medium">
                                            Status
                                        </th>
                                        <th scope="col" className="hidden w-32 px-3 py-2 font-medium lg:table-cell">
                                            Updated
                                        </th>
                                        <th scope="col" className="w-36 py-2 pl-3 pr-4 text-right">
                                            <span className="sr-only">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {filteredBatches.map((batch) => {
                                        const selectable = batch.safeForApproval > 0;
                                        const reviewable = (batch.reviewResultIds ?? []).length > 0;

                                        return (
                                            <tr
                                                key={batch.batchId}
                                                onClick={() => selectable && toggleBatch(batch.batchId)}
                                                className={cn(
                                                    "transition-colors",
                                                    selectable ? "cursor-pointer" : "cursor-default",
                                                    !selectable && !reviewable && "opacity-70",
                                                    batch.isSelected
                                                        ? "bg-primary-soft hover:bg-primary-soft"
                                                        : selectable && "hover:bg-surface-hover"
                                                )}
                                            >
                                                <td className="py-2 pl-4 pr-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={batch.isSelected}
                                                        onChange={() => toggleBatch(batch.batchId)}
                                                        onClick={(event) => event.stopPropagation()}
                                                        disabled={!selectable}
                                                        aria-label={`Select ${batch.batchName}`}
                                                        className={CHECKBOX_CLASS}
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="min-w-0">
                                                        <div className="truncate font-medium text-fg" title={batch.batchName}>
                                                            {batch.batchName}
                                                        </div>
                                                        <div className="truncate text-xs text-fg-muted">
                                                            <span className="font-mono" title={batch.batchCode}>
                                                                {batch.batchCode}
                                                            </span>
                                                            <span className="md:hidden"> · {batch.department}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="hidden px-3 py-2 text-fg-secondary md:table-cell">
                                                    <span className="block truncate" title={batch.department}>
                                                        {batch.department}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums text-fg-secondary">
                                                    {batch.totalResults}
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium tabular-nums text-fg">
                                                    {batch.safeForApproval}
                                                </td>
                                                <td
                                                    className={cn(
                                                        "px-3 py-2 text-right tabular-nums",
                                                        batch.exceptions > 0 ? "font-medium text-status-pending-fg" : "text-fg-muted"
                                                    )}
                                                >
                                                    {batch.exceptions}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <StatusChip tone={batch.exceptions === 0 ? "success" : "pending"} dot size="sm">
                                                        {batch.exceptions === 0 ? "Safe group" : "Review mixed"}
                                                    </StatusChip>
                                                </td>
                                                <td className="hidden px-3 py-2 text-fg-muted lg:table-cell">
                                                    {batch.updatedAt ? (
                                                        <time dateTime={batch.updatedAt}>{formatAuditTime(batch.updatedAt)}</time>
                                                    ) : (
                                                        <span className="text-fg-faint">—</span>
                                                    )}
                                                </td>
                                                <td className="py-2 pl-3 pr-4 text-right">
                                                    {batch.exceptions === 0 ? (
                                                        <span className="text-xs text-fg-muted">No review needed</span>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                handleReviewCases(batch.reviewResultIds ?? []);
                                                            }}
                                                            disabled={!reviewable}
                                                            aria-label={`Review ${batch.exceptions} held ${batch.exceptions === 1 ? "case" : "cases"} in ${batch.batchName}`}
                                                        >
                                                            Review cases
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>

                <SectionCard title="Approval rules" className="lg:sticky lg:top-20">
                    <div className="space-y-5">
                        <div>
                            <p className="flex items-center gap-1.5 text-xs font-medium text-status-verified-fg">
                                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                                Eligible for bulk approval
                            </p>
                            <ul className="mt-2 space-y-2 text-sm text-fg-secondary">
                                <li className="flex items-start gap-2">
                                    <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-verified" />
                                    <span>
                                        Result status is <code className="font-mono text-xs font-medium text-fg">ENTERED</code>
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-verified" />
                                    <span>
                                        Flag is <code className="font-mono text-xs font-medium text-fg">NORMAL</code> or not set
                                    </span>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <p className="flex items-center gap-1.5 text-xs font-medium text-status-pending-fg">
                                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                Held for manual review
                            </p>
                            <ul className="mt-2 space-y-2 text-sm text-fg-secondary">
                                <li className="flex items-start gap-2">
                                    <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-pending" />
                                    <span>Cases returned to the supervisor</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-pending" />
                                    <span>
                                        <code className="font-mono text-xs font-medium text-fg">HIGH</code> or{" "}
                                        <code className="font-mono text-xs font-medium text-fg">LOW</code> flagged results
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-pending" />
                                    <span>
                                        <code className="font-mono text-xs font-medium text-fg">CRITICAL_HIGH</code> or{" "}
                                        <code className="font-mono text-xs font-medium text-fg">CRITICAL_LOW</code> flagged results
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </SectionCard>
            </div>

            {/* Selection summary bar — sticks to the bottom while the table scrolls */}
            {selectedBatches.length > 0 && (
                <section
                    aria-label="Selection summary"
                    className="sticky bottom-0 z-20 mt-4 rounded-lg border border-edge bg-surface p-3 sm:p-4"
                >
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        <dl className="flex flex-wrap gap-x-6 gap-y-2">
                            <div>
                                <dt className="text-xs text-fg-muted">Selected groups</dt>
                                <dd className="text-base font-semibold tabular-nums text-fg">{selectedBatches.length}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-fg-muted">Safe for approval</dt>
                                <dd className="text-base font-semibold tabular-nums text-status-verified-fg">
                                    {totalSafeForApproval}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-fg-muted">Held for review</dt>
                                <dd className="text-base font-semibold tabular-nums text-status-pending-fg">
                                    {totalExceptions}
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
                                disabled={isSubmitting || selectedResultIds.length === 0}
                            >
                                Approve safe results
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            <Modal
                open={isConfirming}
                onClose={closeConfirm}
                dismissible={!isSubmitting}
                title={`Approve ${selectedResultIds.length} safe ${caseWord}?`}
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
                <dl className="mb-4 grid grid-cols-3 gap-3 rounded-md border border-edge bg-surface-muted px-3 py-2 text-xs">
                    <div>
                        <dt className="text-fg-muted">Groups</dt>
                        <dd className="font-semibold tabular-nums text-fg">{selectedBatches.length}</dd>
                    </div>
                    <div>
                        <dt className="text-fg-muted">Safe {caseWord}</dt>
                        <dd className="font-semibold tabular-nums text-status-verified-fg">{totalSafeForApproval}</dd>
                    </div>
                    <div>
                        <dt className="text-fg-muted">Held for review</dt>
                        <dd className="font-semibold tabular-nums text-status-pending-fg">{totalExceptions}</dd>
                    </div>
                </dl>
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
