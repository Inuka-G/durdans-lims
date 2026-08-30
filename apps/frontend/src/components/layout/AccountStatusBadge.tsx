/**
 * Replaces the hardcoded role-description line every top-bar shell used to
 * show under the account name (e.g. "Super admin · Global controller",
 * "Branch admin · Senior branch manager") — text that was static regardless
 * of who was actually logged in or what roles they held. If the session
 * rendered at all, it's an active, authenticated one, so this shows exactly
 * that rather than a made-up title.
 */
export default function AccountStatusBadge() {
    return (
        <span className="inline-flex items-center gap-1.5 text-status-verified-fg">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-verified" aria-hidden="true" />
            Active session
        </span>
    );
}
