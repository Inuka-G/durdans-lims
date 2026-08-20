"use client";
import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PatientProvider, usePatient } from "./PatientProvider";

const CRUMB_LINK =
    "rounded hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/**
 * Breadcrumb for every route under /patients/[id] (profile tabs and edit).
 * Rendered inside the provider so it can show the patient's name once loaded;
 * falls back to the route id while loading or on error.
 */
function PatientCrumbs({ id }: { id: string }) {
    const { patient } = usePatient();
    const pathname = usePathname();
    const profileHref = `/patients/${id}`;
    const isEdit = pathname.endsWith("/edit");
    const name =
        patient?.fullName ||
        [patient?.firstName, patient?.lastName].filter(Boolean).join(" ") ||
        id;

    return (
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-fg-muted">
            <Link href="/patients" className={CRUMB_LINK}>
                Patients
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0 text-fg-faint" aria-hidden="true" />
            {isEdit ? (
                <>
                    <Link href={profileHref} className={`${CRUMB_LINK} max-w-[60vw] truncate`}>
                        {name}
                    </Link>
                    <ChevronRight className="h-3 w-3 shrink-0 text-fg-faint" aria-hidden="true" />
                    <span className="text-fg-secondary" aria-current="page">
                        Edit
                    </span>
                </>
            ) : (
                <span className="max-w-[60vw] truncate text-fg-secondary" aria-current="page">
                    {name}
                </span>
            )}
        </nav>
    );
}

export default function PatientRootLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const resolvedParams = use(params);

    return (
        <PatientProvider id={resolvedParams.id}>
            <div className="mx-auto max-w-6xl">
                <PatientCrumbs id={resolvedParams.id} />
                {children}
            </div>
        </PatientProvider>
    );
}
