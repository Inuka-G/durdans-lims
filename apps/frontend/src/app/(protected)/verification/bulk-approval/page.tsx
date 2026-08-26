"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
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
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { InputField, SelectField, TextareaField } from "@/components/ui/Field";
import { formatAuditTime } from "@/components/patient-dashboard/dashboard-data";

type SelectableBatch = BulkVerificationBatch & {
    isSelected: boolean;
};

const ALL_DEPARTMENTS = "All Departments";
const SKELETON_CARDS = 8;

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

    const departments = useMemo(
        () => Array.from(new Set(batches.map((batch) => batch.department))).sort(),
        [batches]
    );

    const filteredBatches = useMemo(() => {
        return batches.filter((batch) => {
            const query = search.trim().toLowerCase();
            const matchesSearch =
                query === "" ||
                (batch.batchName ?? "").toLowerCase().includes(query) ||
                (batch.batchCode ?? "").toLowerCase().includes(query);

            const matchesDept =
                department === ALL_DEPARTMENTS ||
                (batch.department ?? "").toLowerCase() === department.toLowerCase();

            return matchesSearch && matchesDept;
        });
    }, [batches, search, department]);

    const totalResultsInQueue = useMemo(
        () => batches.reduce((sum, batch) => sum + batch.totalResults, 0),
        [batches]
    );
    const totalSafeInQueue = useMemo(
        () => batches.reduce((sum, batch) => sum + batch.safeForApproval, 0),
        [batches]
    );
    const totalExceptionsInQueue = useMemo(
        () => batches.reduce((sum, batch) => sum + batch.exceptions, 0),
        [batches]
    );

    const selectedBatches = useMemo(() => batches.filter((batch) => batch.isSelected), [batches]);
    const selectedResultIds = useMemo(
        () => selectedBatches.flatMap((batch) => batch.resultIds ?? []),
        [selectedBatches]
    );
    const totalSafeForApproval = useMemo(
        () => selectedBatches.reduce((sum, batch) => sum + batch.safeForApproval, 0),
        [selectedBatches]
    );
    const totalExceptions = useMemo(
        () => selectedBatches.reduce((sum, batch) => sum + batch.exceptions, 0),
        [selectedBatches]
    );

    const toggleBatch = (id: string) => {
        setBatches((previous) =>
            previous.map((batch) =>
                batch.batchId === id && batch.safeForApproval > 0
                    ? { ...batch, isSelected: !batch.isSelected }
                    : batch
            )
        );
    };

    const selectAllSafeVisible = () => {
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

    const hasFilters = search.trim() !== "" || department !== ALL_DEPARTMENTS;

    const clearFilters = () => {
        setSearch("");
        setDepartment(ALL_DEPARTMENTS);
    };

    const handleApprove = async () => {
        if (selectedResultIds.length === 0) {
            return;
        }

        try {
            setIsSubmitting(true);

            await bulkApproveTechnically({
                resultIds: selectedResultIds,
                status: "TECHNICALLY_VERIFIED",
                mltNotes: undefined,
                supervisorNote: supervisorNote.trim() || "Bulk approval (Safe normal cases)",
            });

            setIsConfirming(false);
            setSupervisorNote("");
            toast.success(`Successfully approved ${selectedResultIds.length} safe cases!`);
            router.push("/verification/pending");
        } catch (submitError) {
            console.error("Failed to bulk approve results", submitError);
            toast.error("Failed to bulk approve results. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReviewCases = (batch: SelectableBatch) => {
        const exceptionCase = batch.cases?.find((c) => !c.safeForApproval) || batch.cases?.[0];
        const targetId =
            exceptionCase?.resultId ||
            (batch.reviewResultIds && batch.reviewResultIds[0]) ||
            (batch.resultIds && batch.resultIds[0]);

        if (targetId) {
            router.push(`/verification/review/${targetId}`);
        } else {
            router.push("/verification/pending");
        }
    };

    const caseWord = selectedResultIds.length === 1 ? "case" : "cases";

    return (
        <div className="mx-auto max-w-[1400px] space-y-6">
            <PageHeader
                crumbs={[{ label: "Verification", href: "/verification/pending" }, { label: "Bulk approval" }]}
                title="Bulk technical approval"
                meta={
                    <span>Approve safe result groups while holding exceptions for case-by-case review.</span>
                }
                actions={
                    <Button icon={RefreshCw} onClick={() => void loadBulkWorklist()} loading={loading}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? "Loading bulk verification worklist"
                    : error
                      ? "Bulk verification worklist failed to load"
                      : `Showing ${filteredBatches.length} of ${batches.length} test groups. ${selectedBatches.length} selected.`}
            </p>

            {/* Filter toolbar */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-surface-muted px-3 py-2">
                <InputField
                    label="Search test groups"
                    hideLabel
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search test group or code..."
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

                <div className="flex-1" />

                <Button
                    onClick={selectAllSafeVisible}
                    disabled={loading || filteredBatches.every((batch) => batch.safeForApproval === 0)}
                    icon={ListChecks}
                    size="sm"
                >
                    Select Safe Groups
                </Button>
                <span className="text-xs font-medium text-fg-muted">
                    Showing {filteredBatches.length} review-ready groups
                </span>
            </div>

            {/* Content Cards Grid */}
            <div className="pb-28">
                {loading ? (
                    <div aria-hidden="true" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {Array.from({ length: SKELETON_CARDS }).map((_, index) => (
                            <div key={index} className="rounded-xl border border-edge bg-surface p-4 shadow-sm">
                                <span className="block h-4 w-32 rounded bg-skeleton" />
                                <span className="mt-2 block h-3 w-24 rounded bg-skeleton" />
                                <span className="mt-4 block h-6 w-16 rounded bg-skeleton" />
                                <span className="mt-4 block h-3 w-full rounded bg-skeleton" />
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="rounded-xl border border-edge bg-surface p-6 shadow-sm">
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
                ) : filteredBatches.length === 0 ? (
                    <div className="rounded-xl border border-edge bg-surface p-6 shadow-sm">
                        {hasFilters ? (
                            <EmptyState
                                icon={Search}
                                title="No test groups match"
                                description="Try a different search term or department filter."
                                action={
                                    <Button size="sm" icon={X} onClick={clearFilters}>
                                        Clear filters
                                    </Button>
                                }
                            />
                        ) : (
                            <EmptyState
                                icon={ShieldCheck}
                                title="No test groups waiting"
                                description="Groups waiting for technical verification will appear here automatically."
                            />
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredBatches.map((batch) => {
                            const selectable = batch.safeForApproval > 0;
                            const reviewable = (batch.reviewResultIds ?? []).length > 0;

                            return (
                                <div
                                    key={batch.batchId}
                                    onClick={() => selectable && toggleBatch(batch.batchId)}
                                    className={cn(
                                        "relative rounded-xl border bg-surface p-4 shadow-sm transition-all",
                                        batch.isSelected
                                            ? "border-2 border-primary bg-primary-soft"
                                            : "border-edge hover:border-edge-strong hover:shadow",
                                        selectable ? "cursor-pointer" : reviewable ? "cursor-default" : "cursor-not-allowed opacity-70"
                                    )}
                                >
                                    <div className="absolute left-4 top-4">
                                        <input
                                            type="checkbox"
                                            checked={batch.isSelected}
                                            disabled={!selectable}
                                            onChange={() => selectable && toggleBatch(batch.batchId)}
                                            onClick={(event) => event.stopPropagation()}
                                            aria-label={`Select ${batch.batchName}`}
                                            className={CHECKBOX_CLASS}
                                        />
                                    </div>

                                    <div className="pl-8">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="text-sm font-bold leading-snug text-fg" title={batch.batchName}>
                                                {batch.batchName}
                                            </h3>
                                            <span
                                                className={cn(
                                                    "shrink-0 rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                                                    batch.exceptions === 0
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-amber-100 text-amber-700"
                                                )}
                                            >
                                                {batch.exceptions === 0 ? "SAFE GROUP" : "REVIEW MIXED"}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-[11px] text-fg-muted">
                                            Code: {batch.batchCode} &bull; {batch.department}
                                        </p>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-4 pl-8">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                                                Total Results
                                            </span>
                                            <p className="mt-0.5 text-2xl font-bold text-fg">
                                                {batch.totalResults}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                                                Safe for Approval
                                            </span>
                                            <p className="mt-0.5 text-2xl font-bold text-primary">
                                                {batch.safeForApproval}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 border-t border-edge pl-8 pt-3">
                                        {batch.exceptions === 0 ? (
                                            <div className="flex items-center gap-1.5">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                                                <span className="text-xs font-bold text-emerald-700">
                                                    No Manual Review Needed
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                                                    <span className="text-xs font-bold text-amber-700">
                                                        {batch.exceptions} Held for Review
                                                    </span>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    icon={ExternalLink}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleReviewCases(batch);
                                                    }}
                                                    disabled={!reviewable}
                                                >
                                                    Review Cases
                                                </Button>
                                            </div>
                                        )}
                                        {batch.updatedAt && (
                                            <p className="mt-2 text-[11px] text-fg-muted">
                                                Last updated: {formatAuditTime(batch.updatedAt)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Floating Bulk Action Bar */}
            {selectedBatches.length > 0 && (
                <section
                    aria-label="Bulk selection summary"
                    className="fixed bottom-6 left-0 z-40 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-xl border border-edge bg-surface p-4 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] lg:left-64 lg:right-8"
                >
                    <div className="flex flex-wrap items-center gap-8">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                                Selected Groups
                            </span>
                            <p className="mt-0.5 text-base font-bold text-fg">
                                {selectedBatches.length} {selectedBatches.length === 1 ? "Group" : "Groups"} Selected
                            </p>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                                Safe for Approval
                            </span>
                            <p className="mt-0.5 text-base font-bold text-emerald-600">
                                {totalSafeForApproval} Results
                            </p>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                                Held for Review
                            </span>
                            <p className="mt-0.5 text-base font-bold text-amber-600">
                                {totalExceptions} Results
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button onClick={clearSelection} disabled={isSubmitting}>
                            Clear Selection
                        </Button>
                        <Button
                            variant="primary"
                            icon={CheckCircle2}
                            onClick={() => setIsConfirming(true)}
                            disabled={isSubmitting || selectedResultIds.length === 0}
                        >
                            Approve Safe Results ({selectedResultIds.length})
                        </Button>
                    </div>
                </section>
            )}

            {/* Confirmation Modal */}
            <Modal
                open={isConfirming}
                onClose={() => setIsConfirming(false)}
                dismissible={!isSubmitting}
                title={`Approve ${selectedResultIds.length} safe ${caseWord}?`}
                description="Every parameter on these specimens is within its reference range. Each case will be marked technically verified under your name and released to the pathologist worklist."
                footer={
                    <>
                        <Button onClick={() => setIsConfirming(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button variant="primary" icon={CheckCircle2} onClick={handleApprove} loading={isSubmitting}>
                            {isSubmitting ? "Approving…" : "Confirm Approval"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="max-h-40 divide-y divide-edge overflow-y-auto rounded-lg border border-edge bg-surface-muted p-2 text-xs">
                        <p className="font-semibold text-fg mb-1 px-1">Selected Test Groups:</p>
                        {selectedBatches.map((batch) => (
                            <div key={batch.batchId} className="flex items-center justify-between py-1.5 px-1">
                                <span className="font-medium text-fg">{batch.batchName}</span>
                                <span className="font-mono text-emerald-600 font-bold">
                                    {batch.safeForApproval} safe results
                                </span>
                            </div>
                        ))}
                    </div>

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
                </div>
            </Modal>
        </div>
    );
}
