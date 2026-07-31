"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    BulkVerificationBatch,
    bulkApproveTechnically,
    getBulkVerificationWorklist,
} from "@/lib/api";

type SelectableBatch = BulkVerificationBatch & {
    isSelected: boolean;
};

const formatTimestamp = (value?: string | null) => {
    if (!value) {
        return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "-";
    }

    return parsed.toLocaleString("en-LK", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export default function BulkApprovalPage() {
    const router = useRouter();
    const [batches, setBatches] = useState<SelectableBatch[]>([]);
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState("All Departments");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const loadBulkWorklist = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await getBulkVerificationWorklist();
                setBatches(response.map((batch) => ({ ...batch, isSelected: false })));
            } catch (loadError) {
                console.error("Failed to load bulk verification worklist", loadError);
                setError("Failed to load bulk verification worklist. Please try again.");
                setBatches([]);
            } finally {
                setLoading(false);
            }
        };

        void loadBulkWorklist();
    }, []);

    const filteredBatches = useMemo(() => {
        return batches.filter((batch) => {
            const matchesSearch =
                search.trim() === "" ||
                batch.batchName.toLowerCase().includes(search.toLowerCase()) ||
                batch.batchCode.toLowerCase().includes(search.toLowerCase());

            const matchesDept =
                department === "All Departments" ||
                batch.department.toLowerCase() === department.toLowerCase();

            return matchesSearch && matchesDept;
        });
    }, [batches, search, department]);

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
            });

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

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Bulk Technical Verification</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Approve safe result groups while holding exceptions for case-by-case review.
                    </p>
                </div>

                <div className="text-right">
                    <div className="text-xs text-slate-500 font-medium">
                        Role: Lab Supervisor <span className="mx-1">|</span> Queue: Verification
                    </div>
                    <div className="mt-2 text-right">
                        <div className="flex items-center justify-end gap-3 mb-1.5">
                            <span className="text-[11px] font-bold text-slate-500 tracking-wide uppercase">
                                Safe Results
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 tracking-wide uppercase">
                                {batches.reduce((sum, batch) => sum + batch.safeForApproval, 0)} Ready
                            </span>
                        </div>
                        <div className="w-56 h-1.5 bg-slate-200 rounded-full overflow-hidden ml-auto">
                            <div
                                className="h-full bg-primary rounded-full"
                                style={{
                                    width:
                                        batches.length === 0
                                            ? "0%"
                                            : `${Math.min(
                                                100,
                                                Math.round(
                                                    (batches.reduce((sum, batch) => sum + batch.safeForApproval, 0) /
                                                        Math.max(
                                                            1,
                                                            batches.reduce((sum, batch) => sum + batch.totalResults, 0)
                                                        )) *
                                                        100
                                                )
                                            )}%`,
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                        search
                    </span>
                    <input
                        type="text"
                        placeholder="Search test group..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-56 bg-white"
                    />
                </div>

                <select
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className="py-2 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-slate-600 outline-none"
                >
                    <option>All Departments</option>
                    {Array.from(new Set(batches.map((batch) => batch.department))).map((item) => (
                        <option key={item}>{item}</option>
                    ))}
                </select>

                <div className="flex-1" />

                <button
                    onClick={selectAll}
                    disabled={loading || filteredBatches.every((batch) => batch.safeForApproval === 0)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Select Safe Groups
                </button>
                <span className="text-xs text-slate-500 font-medium">
                    Showing {filteredBatches.length} review-ready groups
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start pb-20">
                <div>
                    {loading ? (
                        <div className="bg-white rounded-xl border border-slate-200/60 p-12 text-center text-slate-400 text-sm shadow-sm">
                            Loading bulk verification worklist...
                        </div>
                    ) : error ? (
                        <div className="bg-white rounded-xl border border-slate-200/60 p-12 text-center shadow-sm">
                            <p className="text-sm text-slate-500">{error}</p>
                        </div>
                    ) : filteredBatches.length === 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200/60 p-12 text-center text-slate-400 text-sm shadow-sm">
                            No test groups found matching your filters.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredBatches.map((batch) => {
                                const selectable = batch.safeForApproval > 0;
                                const reviewable = (batch.reviewResultIds ?? []).length > 0;

                                return (
                                    <div
                                        key={batch.batchId}
                                        onClick={() => selectable && toggleBatch(batch.batchId)}
                                        className={`bg-white rounded-xl p-4 relative transition-colors shadow-sm ${batch.isSelected ? "border-2 border-primary" : "border border-slate-200/60 hover:border-slate-300"} ${selectable ? "cursor-pointer" : reviewable ? "cursor-default" : "cursor-not-allowed opacity-70"}`}
                                    >
                                        <div className="absolute top-4 left-4">
                                            <input
                                                type="checkbox"
                                                checked={batch.isSelected}
                                                onChange={() => toggleBatch(batch.batchId)}
                                                disabled={!selectable}
                                                className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 cursor-pointer"
                                                onClick={(event) => event.stopPropagation()}
                                            />
                                        </div>

                                        <div className="flex items-start justify-between pl-8 mb-2">
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">
                                                    {batch.batchName}
                                                </div>
                                                <div className="text-[11px] text-slate-400 mt-0.5">
                                                    Code: {batch.batchCode} - {batch.department}
                                                </div>
                                            </div>
                                            <span
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${batch.exceptions === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}
                                            >
                                                {batch.exceptions === 0 ? "SAFE GROUP" : "REVIEW MIXED"}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mt-5 pl-8">
                                            <div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                    Total Results
                                                </div>
                                                <div className="text-2xl font-bold text-slate-800 mt-0.5">
                                                    {batch.totalResults}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                    Safe for Approval
                                                </div>
                                                <div className="text-2xl font-bold text-primary mt-0.5">
                                                    {batch.safeForApproval}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 pl-8 pt-4 border-t border-slate-100">
                                            {batch.exceptions === 0 ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="material-icons text-emerald-500 text-[16px]">check_circle</span>
                                                    <span className="text-xs text-emerald-600 font-bold">No Manual Review Needed</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="material-icons text-amber-500 text-[16px]">warning</span>
                                                        <span className="text-xs text-amber-600 font-bold">
                                                            {batch.exceptions} Held for Review
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleReviewCases(batch.reviewResultIds ?? []);
                                                        }}
                                                        disabled={!reviewable}
                                                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Review Cases
                                                    </button>
                                                </div>
                                            )}
                                            <div className="mt-2 text-[11px] text-slate-400">
                                                Last updated: {formatTimestamp(batch.updatedAt)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm p-5 sticky top-24">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                        <span className="material-icons text-primary text-[18px]">rule</span>
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                            Approval Rules
                        </span>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                                Eligible for Bulk Approval
                            </p>
                            <ul className="mt-2 space-y-2 text-sm text-slate-600">
                                <li className="flex items-start gap-2">
                                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                                    <span>
                                        Result status is <span className="font-semibold text-slate-800">ENTERED</span>
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                                    <span>
                                        Flag is <span className="font-semibold text-slate-800">NORMAL</span> or not set
                                    </span>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                                Held for Manual Review
                            </p>
                            <ul className="mt-2 space-y-2 text-sm text-slate-600">
                                <li className="flex items-start gap-2">
                                    <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                                    <span>Returned to Supervisor cases</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                                    <span>
                                        <span className="font-semibold text-slate-800">HIGH</span> or{" "}
                                        <span className="font-semibold text-slate-800">LOW</span> flagged results
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                                    <span>
                                        <span className="font-semibold text-slate-800">CRITICAL_HIGH</span> or{" "}
                                        <span className="font-semibold text-slate-800">CRITICAL_LOW</span> flagged results
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {selectedBatches.length > 0 && (
                <div className="fixed bottom-6 left-[280px] right-8 bg-white border border-slate-200 rounded-xl p-4 flex items-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] z-40 gap-8">
                    <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Selected Groups</div>
                        <div className="text-base font-bold text-slate-800 mt-0.5">{selectedBatches.length} Groups Selected</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Safe for Approval</div>
                        <div className="text-base font-bold text-emerald-600 mt-0.5">{totalSafeForApproval} Results</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Held for Review</div>
                        <div className="text-base font-bold text-red-600 mt-0.5">{totalExceptions} Results</div>
                    </div>

                    <div className="flex-1" />

                    <button
                        onClick={clearSelection}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 text-sm font-bold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Clear Selection
                    </button>
                    <button
                        onClick={handleApprove}
                        disabled={isSubmitting || selectedResultIds.length === 0}
                        className="px-5 py-2.5 text-sm font-bold border-none rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <span className="material-icons text-[18px]">check_circle</span>
                        Approve Safe Results
                    </button>
                </div>
            )}
        </div>
    );
}
