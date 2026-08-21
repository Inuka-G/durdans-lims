import { describe, expect, it } from "vitest";
import type { TestResultSummary } from "./api";
import {
    FLAG_FILTER_OPTIONS,
    PRIORITY_FILTER_OPTIONS,
    countFilterOptions,
    isCritical,
    isFlagged,
    matchesFlagFilter,
    matchesPriorityFilter,
    matchesSearchQuery,
    pageCount,
} from "./review-worklist";

const row = (overrides: Partial<TestResultSummary>): TestResultSummary => ({
    resultId: "12345678-1234-1234-1234-1234567890ab",
    resultNo: "RES2026-00042",
    status: "ENTERED",
    patientCode: "PAT2026-00007",
    patientName: "Nimal Perera",
    testType: "Full Blood Count",
    mltName: "Kasun MLT",
    technicianName: "Sup Test",
    priorityLevel: "NORMAL",
    flag: "NORMAL",
    hasCriticalFinding: false,
    ...overrides,
});

describe("flag helpers", () => {
    it("keeps critical a strict subset of flagged", () => {
        const high = row({ flag: "HIGH" });
        const panic = row({ flag: "CRITICAL_LOW" });
        const normal = row({ flag: "NORMAL" });
        expect(isFlagged(high)).toBe(true);
        expect(isCritical(high)).toBe(false);
        expect(isFlagged(panic)).toBe(true);
        expect(isCritical(panic)).toBe(true);
        expect(isFlagged(normal)).toBe(false);
        expect(isCritical(normal)).toBe(false);
    });

    it("trusts the server's critical finding even when the summary flag is normal", () => {
        const hidden = row({ flag: "NORMAL", hasCriticalFinding: true });
        expect(isCritical(hidden)).toBe(true);
        expect(matchesFlagFilter(hidden, "CRITICAL")).toBe(true);
        expect(matchesFlagFilter(hidden, "NORMAL")).toBe(false);
    });
});

describe("matchesSearchQuery", () => {
    it("matches the case number in both forms, the patient, the test and the staff", () => {
        const r = row({});
        for (const term of ["res2026-00042", "res-567890ab", "nimal", "pat2026-00007", "blood", "kasun", "sup test"]) {
            expect(matchesSearchQuery(r, term)).toBe(true);
        }
    });

    it("does not match unrelated text and treats an empty query as match-all", () => {
        expect(matchesSearchQuery(row({}), "zzz")).toBe(false);
        expect(matchesSearchQuery(row({}), "")).toBe(true);
    });
});

describe("filter option counts", () => {
    const rows = [
        row({ priorityLevel: "STAT", flag: "CRITICAL_HIGH", hasCriticalFinding: true }),
        row({ priorityLevel: "URGENT", flag: "HIGH" }),
        row({ priorityLevel: "NORMAL", flag: "NORMAL" }),
        row({ priorityLevel: "NORMAL", flag: "NORMAL" }),
    ];

    it("previews how many rows each priority leaves", () => {
        const counts = Object.fromEntries(
            countFilterOptions(rows, PRIORITY_FILTER_OPTIONS, matchesPriorityFilter).map((o) => [o.value, o.count])
        );
        expect(counts).toEqual({ ALL: 4, STAT: 1, URGENT: 1, NORMAL: 2 });
    });

    it("previews how many rows each flag state leaves", () => {
        const counts = Object.fromEntries(
            countFilterOptions(rows, FLAG_FILTER_OPTIONS, matchesFlagFilter).map((o) => [o.value, o.count])
        );
        expect(counts).toEqual({ ALL: 4, FLAGGED: 2, CRITICAL: 1, NORMAL: 2 });
    });
});

describe("pageCount", () => {
    it("never reports fewer than one page", () => {
        expect(pageCount(0, 10)).toBe(1);
        expect(pageCount(10, 10)).toBe(1);
        expect(pageCount(11, 10)).toBe(2);
    });
});
