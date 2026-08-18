/**
 * Quick date ranges for the verification and clinical audit history screens.
 *
 * The bound is computed here and sent to the backend as `fromTimestamp` rather
 * than filtering a page client-side: the history is paginated, so filtering
 * after the fetch would only ever narrow the current page and quietly hide
 * older matches behind pagination.
 */
export type HistoryDateRange = "ALL" | "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS";

export const HISTORY_DATE_RANGES: { key: HistoryDateRange; label: string }[] = [
    { key: "ALL", label: "All Time" },
    { key: "TODAY", label: "Today" },
    { key: "LAST_7_DAYS", label: "Last 7 Days" },
    { key: "LAST_30_DAYS", label: "Last 30 Days" },
];

/**
 * Inclusive lower bound for a range, or `undefined` for all time.
 *
 * Returned without a zone suffix because the backend binds it to a
 * `LocalDateTime`; an offset would be rejected by the ISO date-time parser.
 * "Today" means local midnight, which is what a user at the bench means by it.
 */
export function resolveFromTimestamp(range: HistoryDateRange): string | undefined {
    if (range === "ALL") {
        return undefined;
    }

    const from = new Date();
    from.setHours(0, 0, 0, 0);

    if (range === "LAST_7_DAYS") {
        from.setDate(from.getDate() - 6);
    } else if (range === "LAST_30_DAYS") {
        from.setDate(from.getDate() - 29);
    }

    const pad = (value: number) => String(value).padStart(2, "0");
    return (
        `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}` +
        `T${pad(from.getHours())}:${pad(from.getMinutes())}:${pad(from.getSeconds())}`
    );
}
