import type { ChipTone } from "@/components/ui/StatusChip";
import { formatDisplayId } from "@/lib/format-id";

/**
 * The case number a result is known by on every screen: the server-issued
 * `RES2026-00042` when the specimen has one, else the lossless UUID-tail form
 * for rows that predate case numbers and were never backfilled.
 */
export function displayResultNo(resultNo?: string | null, resultId?: string | null): string {
    const trimmed = resultNo?.trim();
    if (trimmed) {
        return formatDisplayId(trimmed, "RES");
    }
    return formatDisplayId(resultId, "RES");
}

/** Result workflow status → the label staff read. */
const RESULT_STATUS_LABELS: Record<string, string> = {
    ENTERED: "Pending verification",
    RETURNED_FOR_RECHECK: "Returned to supervisor",
    RETURNED_TO_MLT: "Returned to MLT",
    TECHNICALLY_VERIFIED: "Technically verified",
    CLINICALLY_AUTHORIZED: "Clinically authorized",
    DISPATCHED: "Dispatched",
    REJECTED: "Rejected",
    RETURNED: "Returned",
};

/** Result workflow status → chip tone (colour = meaning). */
const RESULT_STATUS_TONES: Record<string, ChipTone> = {
    ENTERED: "info",
    RETURNED_FOR_RECHECK: "pending",
    RETURNED_TO_MLT: "danger",
    TECHNICALLY_VERIFIED: "success",
    CLINICALLY_AUTHORIZED: "success",
    DISPATCHED: "info",
    REJECTED: "danger",
    RETURNED: "pending",
};

export function resultStatusLabel(status?: string | null, fallback = "Pending verification"): string {
    if (!status) {
        return fallback;
    }
    const key = status.toUpperCase();
    if (RESULT_STATUS_LABELS[key]) {
        return RESULT_STATUS_LABELS[key];
    }
    const words = key.replace(/[_-]+/g, " ").trim().toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

export function resultStatusTone(status?: string | null): ChipTone {
    if (!status) {
        return "pending";
    }
    return RESULT_STATUS_TONES[status.toUpperCase()] ?? "neutral";
}

/** `+12.5%` / `-3.0%`; null when there is no comparable prior value. */
export function formatDeltaPercent(deltaPercent?: number | null): string | null {
    if (deltaPercent == null || !Number.isFinite(deltaPercent)) {
        return null;
    }
    const sign = deltaPercent > 0 ? "+" : "";
    return `${sign}${deltaPercent.toFixed(1)}%`;
}

export type DeltaTone = "neutral" | "pending" | "danger";

/** Significant delta is danger; any other measurable change is pending; no change / no prior is neutral. */
export function deltaTone(deltaPercent?: number | null, significant?: boolean | null): DeltaTone {
    if (deltaPercent == null) {
        return "neutral";
    }
    if (significant) {
        return "danger";
    }
    return Math.abs(deltaPercent) >= 0.05 ? "pending" : "neutral";
}
