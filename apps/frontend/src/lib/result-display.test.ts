import { describe, expect, it } from "vitest";
import {
    deltaTone,
    displayResultNo,
    formatDeltaPercent,
    resultStatusLabel,
    resultStatusTone,
} from "./result-display";

describe("displayResultNo", () => {
    it("prefers the server-issued case number", () => {
        expect(displayResultNo("RES2026-00042", "12345678-1234-1234-1234-1234567890ab")).toBe("RES2026-00042");
    });

    it("falls back to the lossless UUID tail when no case number exists", () => {
        expect(displayResultNo(null, "12345678-1234-1234-1234-1234567890ab")).toBe("RES-567890AB");
        expect(displayResultNo("   ", "12345678-1234-1234-1234-1234567890ab")).toBe("RES-567890AB");
    });

    it("is N/A when neither is known", () => {
        expect(displayResultNo(undefined, undefined)).toBe("N/A");
    });
});

describe("resultStatusLabel / resultStatusTone", () => {
    it("tells the two return directions apart", () => {
        expect(resultStatusLabel("RETURNED_TO_MLT")).toBe("Returned to MLT");
        expect(resultStatusLabel("RETURNED_FOR_RECHECK")).toBe("Returned to supervisor");
        expect(resultStatusTone("RETURNED_TO_MLT")).toBe("danger");
        expect(resultStatusTone("RETURNED_FOR_RECHECK")).toBe("pending");
    });

    it("reads a missing status as pending verification", () => {
        expect(resultStatusLabel(null)).toBe("Pending verification");
        expect(resultStatusTone(null)).toBe("pending");
    });

    it("humanizes an unknown status instead of leaking the enum", () => {
        expect(resultStatusLabel("SOME_NEW_STATE")).toBe("Some new state");
        expect(resultStatusTone("SOME_NEW_STATE")).toBe("neutral");
    });
});

describe("formatDeltaPercent / deltaTone", () => {
    it("formats a signed one-decimal percent", () => {
        expect(formatDeltaPercent(12.54)).toBe("+12.5%");
        expect(formatDeltaPercent(-3)).toBe("-3.0%");
        expect(formatDeltaPercent(0)).toBe("0.0%");
    });

    it("is null without a comparable prior value", () => {
        expect(formatDeltaPercent(null)).toBeNull();
        expect(formatDeltaPercent(undefined)).toBeNull();
        expect(formatDeltaPercent(Number.NaN)).toBeNull();
    });

    it("colours a significant delta as danger, a change as pending, no change as neutral", () => {
        expect(deltaTone(55, true)).toBe("danger");
        expect(deltaTone(12, false)).toBe("pending");
        expect(deltaTone(0, false)).toBe("neutral");
        expect(deltaTone(null, null)).toBe("neutral");
    });
});
