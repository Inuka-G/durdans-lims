import { Info } from "lucide-react";

/**
 * Marks a screen that renders placeholder data not yet wired to a live backend,
 * so an admin never mistakes mock metrics/toggles for real system state.
 */
export default function DemoDataBanner({ note }: { note?: string }) {
    return (
        <div
            role="note"
            className="mb-4 flex items-start gap-2 rounded-md border border-status-pending-edge bg-status-pending-bg px-4 py-2.5 text-sm font-medium text-status-pending-fg"
        >
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{note ?? "Demo data — this screen is not yet connected to a live backend; values shown are placeholders."}</span>
        </div>
    );
}
