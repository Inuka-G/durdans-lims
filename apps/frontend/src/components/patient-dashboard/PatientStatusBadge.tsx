"use client";

import { cn } from "@/lib/utils";

/**
 * Patient contact-verification status. One token per state, used the same
 * way in table chips, tile notes and the status bar so colour = meaning.
 */
export type PatientVerification = "verified" | "pending";

export const PATIENT_STATUS_TOKEN: Record<
    PatientVerification,
    { label: string; chip: string; dot: string; bar: string }
> = {
    verified: {
        label: "Verified",
        chip: "bg-status-verified-bg text-status-verified-fg ring-status-verified-edge",
        dot: "bg-status-verified",
        bar: "bg-status-verified",
    },
    pending: {
        label: "Pending",
        chip: "bg-status-pending-bg text-status-pending-fg ring-status-pending-edge",
        dot: "bg-status-pending",
        bar: "bg-status-pending",
    },
};

export function getPatientVerification(p: {
    emailVerified?: boolean;
    phoneVerified?: boolean;
}): PatientVerification {
    return p.emailVerified || p.phoneVerified ? "verified" : "pending";
}

export default function PatientStatusBadge({
    status,
    className,
}: {
    status: PatientVerification;
    className?: string;
}) {
    const t = PATIENT_STATUS_TOKEN[status];
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                t.chip,
                className
            )}
        >
            <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
            {t.label}
        </span>
    );
}
