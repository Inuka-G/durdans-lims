import type { TestResultSummary } from "@/lib/api";
import { formatDisplayId } from "@/lib/format-id";
import { displayResultNo } from "@/lib/result-display";

/**
 * The filter vocabulary the supervisor pending queue and the pathologist
 * worklist share: a status dropdown, a priority dropdown and a flag dropdown,
 * each showing how many rows picking it would leave, plus a free-text search
 * over every column. Both lists are loaded whole and filtered here in the
 * browser, so a search or a count always covers every page, not the one open.
 */

export type PriorityFilter = "ALL" | "STAT" | "URGENT" | "NORMAL";
export type FlagFilter = "ALL" | "FLAGGED" | "CRITICAL" | "NORMAL";

export type FilterOption<TValue extends string> = { value: TValue; label: string };
export type CountedFilterOption<TValue extends string> = FilterOption<TValue> & { count: number };

export const PRIORITY_FILTER_OPTIONS: ReadonlyArray<FilterOption<PriorityFilter>> = [
    { value: "ALL", label: "All priorities" },
    { value: "STAT", label: "STAT" },
    { value: "URGENT", label: "Urgent" },
    { value: "NORMAL", label: "Normal" },
];

export const FLAG_FILTER_OPTIONS: ReadonlyArray<FilterOption<FlagFilter>> = [
    { value: "ALL", label: "All flags" },
    { value: "FLAGGED", label: "Flagged" },
    { value: "CRITICAL", label: "Critical" },
    { value: "NORMAL", label: "Normal" },
];

/** Any analyte outside its reference range, panic values included. */
export function isFlagged(result: Pick<TestResultSummary, "flag" | "hasCriticalFinding">): boolean {
    if (result.hasCriticalFinding === true) {
        return true;
    }
    const flag = result.flag?.toUpperCase();
    return Boolean(flag && flag !== "NORMAL");
}

/** Panic-range findings only, so "Critical" stays a strict subset of "Flagged". */
export function isCritical(result: Pick<TestResultSummary, "flag" | "hasCriticalFinding">): boolean {
    if (result.hasCriticalFinding === true) {
        return true;
    }
    const flag = result.flag?.toUpperCase();
    return flag === "CRITICAL_HIGH" || flag === "CRITICAL_LOW";
}

export function matchesPriorityFilter(result: TestResultSummary, priority: PriorityFilter): boolean {
    return priority === "ALL" || (result.priorityLevel ?? "").toUpperCase() === priority;
}

export function matchesFlagFilter(result: TestResultSummary, flag: FlagFilter): boolean {
    if (flag === "ALL") {
        return true;
    }
    if (flag === "CRITICAL") {
        return isCritical(result);
    }
    if (flag === "FLAGGED") {
        return isFlagged(result);
    }
    return !isFlagged(result);
}

/**
 * Free-text match across every column the table shows: case number (both the
 * RES2026-00042 form and the legacy UUID tail), patient name and code, test
 * group, technician / verifier, priority and flag. The query is expected
 * already trimmed and lower-cased.
 */
export function matchesSearchQuery(result: TestResultSummary, query: string): boolean {
    if (query.length === 0) {
        return true;
    }
    const haystack = [
        result.resultId,
        result.resultNo,
        displayResultNo(result.resultNo, result.resultId),
        // The pre-case-number form still circulates on printed worklists and in old
        // chat messages; a supervisor pasting one must still land on the case.
        formatDisplayId(result.resultId, "RES"),
        result.patientCode,
        result.patientName,
        result.testType,
        result.mltName,
        result.technicianName,
        result.pathologistName,
        result.priorityLevel,
        result.flag,
    ];
    return haystack.some((value) => (value ?? "").toLowerCase().includes(query));
}

/** Attach a preview count to each option: how many of `scope` that option would leave. */
export function countFilterOptions<TValue extends string>(
    scope: readonly TestResultSummary[],
    options: ReadonlyArray<FilterOption<TValue>>,
    matches: (result: TestResultSummary, value: TValue) => boolean
): CountedFilterOption<TValue>[] {
    return options.map((option) => ({
        ...option,
        count: scope.filter((result) => matches(result, option.value)).length,
    }));
}

/** Total pages for a client-side paged list; never less than one. */
export function pageCount(total: number, pageSize: number): number {
    return Math.max(1, Math.ceil(total / pageSize));
}
