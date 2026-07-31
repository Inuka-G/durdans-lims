/**
 * Marks a screen that renders placeholder data not yet wired to a live backend,
 * so an admin never mistakes mock metrics/toggles for real system state.
 */
export default function DemoDataBanner({ note }: { note?: string }) {
    return (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[13px] font-semibold px-4 py-2.5 flex items-center gap-2">
            <span className="material-icons text-[18px]">info</span>
            {note ?? "Demo data — this screen is not yet connected to a live backend; values shown are placeholders."}
        </div>
    );
}
