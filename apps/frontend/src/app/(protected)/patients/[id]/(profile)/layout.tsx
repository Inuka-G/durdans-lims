"use client";
import { ReactNode, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowLeft, Camera, Loader2, Pencil, RefreshCw } from "lucide-react";
import { usePatient } from "../PatientProvider";
import { uploadProfilePhoto } from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import PatientStatusBadge, { getPatientVerification } from "@/components/patient-dashboard/PatientStatusBadge";
import { calculateAge, formatGender, formatPhone, patientInitials } from "@/components/patient-dashboard/dashboard-data";

/** "•••• 4567" — never show a full NIC in the always-visible banner. */
function maskNic(nic?: string): string {
    if (!nic) return "—";
    const value = nic.trim();
    if (value.length <= 4) return value;
    return `•••• ${value.slice(-4)}`;
}

/** "16 Aug 2026" — falls back to the raw value when it can't be parsed. */
function formatShortDate(value?: string | number | null): string {
    if (value == null || value === "") return "—";
    const d = new Date(value);
    return isNaN(d.getTime())
        ? String(value)
        : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const TAB_BASE =
    "relative flex h-10 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary";
const TAB_ACTIVE = "border-primary text-fg";
const TAB_IDLE = "border-transparent text-fg-muted hover:border-edge-strong hover:text-fg";

export default function ProfileLayout({ children }: { children: ReactNode }) {
    const { patient, loading, error, refresh } = usePatient();
    const pathname = usePathname();
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (loading) {
        return (
            <>
                <p role="status" aria-live="polite" className="sr-only">
                    Loading patient
                </p>
                <div aria-hidden="true" className="sticky top-16 z-20 mb-4 rounded-lg border border-edge bg-surface">
                    <div className="flex items-center gap-3 px-4 py-3 md:gap-4">
                        <span className="h-12 w-12 shrink-0 rounded-full bg-skeleton md:h-14 md:w-14" />
                        <div className="flex-1 space-y-2">
                            <span className="block h-4 w-48 max-w-full rounded bg-skeleton" />
                            <span className="block h-3 w-72 max-w-full rounded bg-skeleton" />
                        </div>
                        <span className="hidden h-9 w-20 rounded-md bg-skeleton sm:block" />
                    </div>
                    <div className="flex gap-4 border-t border-edge px-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <span key={i} className="my-3 h-4 w-16 rounded bg-skeleton" />
                        ))}
                    </div>
                </div>
            </>
        );
    }

    if (error || !patient) {
        return (
            <div role="alert" className="rounded-lg border border-edge bg-surface">
                <EmptyState
                    icon={AlertTriangle}
                    title="Couldn't load patient"
                    description={error || "Patient record could not be found."}
                    action={
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button size="sm" icon={RefreshCw} onClick={() => refresh()}>
                                Retry
                            </Button>
                            <Button size="sm" icon={ArrowLeft} href="/patients">
                                Back to search
                            </Button>
                        </div>
                    }
                />
            </div>
        );
    }

    const patientParamId = patient.id || patient.patientId;
    const basePath = `/patients/${patientParamId}`;

    const isTabActive = (path: string) => {
        if (path === basePath && pathname === basePath) return true;
        if (path !== basePath && pathname.startsWith(path)) return true;
        return false;
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !patient?.patientCode) return;

        setUploadingPhoto(true);
        setUploadError("");
        try {
            await uploadProfilePhoto(patient.patientCode, file);
            await refresh();
        } catch (error) {
            setUploadError("Failed to upload photo.");
            console.error(error);
        } finally {
            setUploadingPhoto(false);
        }
    };

    const displayName = patient.fullName || `${patient.firstName} ${patient.lastName}`;
    const mrn = patient.patientCode || patientParamId || "—";
    const status = getPatientVerification(patient);

    const tabs = [
        { label: "Overview", href: basePath },
        { label: "Orders", href: `${basePath}/orders` },
        { label: "Reports", href: `${basePath}/reports` },
        { label: "Documents", href: `${basePath}/documents` },
    ];

    return (
        <>
            {/* Patient context banner — sticks under the 64px top nav, above the tab content */}
            <header className="sticky top-16 z-20 mb-4 rounded-lg border border-edge bg-surface">
                <div className="flex items-center gap-3 px-4 py-3 md:gap-4">
                    {/* Avatar + upload control */}
                    <div className="relative shrink-0">
                        <div
                            className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-skeleton text-sm font-semibold text-fg-secondary md:h-14 md:w-14"
                            aria-busy={uploadingPhoto || undefined}
                        >
                            {patient.profilePhotoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={patient.profilePhotoUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span aria-hidden="true">{patientInitials(displayName)}</span>
                            )}
                            {uploadingPhoto && (
                                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-surface/70">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingPhoto}
                            aria-label="Upload profile photo"
                            className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-edge bg-surface text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                        >
                            <Camera className="h-3 w-3" aria-hidden="true" />
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handlePhotoUpload}
                            accept="image/*"
                            className="hidden"
                            tabIndex={-1}
                            aria-hidden="true"
                        />
                    </div>

                    {/* Identity */}
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight text-fg">{displayName}</h1>
                            <PatientStatusBadge status={status} />
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-fg-secondary">
                            <span className="min-w-0 max-w-full break-all">
                                <span className="text-fg-muted">MRN </span>
                                <span className="font-mono">{mrn}</span>
                            </span>
                            <span aria-hidden="true" className="text-fg-faint">·</span>
                            <span className="tabular-nums">
                                <span className="sr-only">Age / sex </span>
                                {calculateAge(patient.dob)}
                                <span className="text-fg-faint"> / </span>
                                {formatGender(patient.gender)}
                            </span>
                            <span aria-hidden="true" className="text-fg-faint">·</span>
                            <span className="tabular-nums">
                                <span className="text-fg-muted">DOB </span>
                                {formatShortDate(patient.dob)}
                            </span>
                            <span aria-hidden="true" className="text-fg-faint">·</span>
                            <span className="tabular-nums">
                                <span className="text-fg-muted">NIC </span>
                                {maskNic(patient.identityNumber)}
                            </span>
                            <span aria-hidden="true" className="text-fg-faint">·</span>
                            <span className="tabular-nums">
                                <span className="sr-only">Phone </span>
                                {formatPhone(patient.phoneNumber || patient.phone)}
                            </span>
                            {patient.updatedAt != null && patient.updatedAt !== "" && (
                                <>
                                    <span aria-hidden="true" className="hidden text-fg-faint md:inline">·</span>
                                    <span className="hidden tabular-nums md:inline">
                                        <span className="text-fg-muted">Updated </span>
                                        {formatShortDate(patient.updatedAt)}
                                    </span>
                                </>
                            )}
                        </p>
                        {uploadError && (
                            <p role="alert" className="mt-1 text-xs font-medium text-status-danger-fg">
                                {uploadError}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 self-start sm:self-center">
                        <Button href={`/patients/${patientParamId}/edit`} icon={Pencil}>
                            Edit
                        </Button>
                    </div>
                </div>

                {/* Tabs — links, scroll horizontally on small screens */}
                <nav aria-label="Patient sections" className="no-scrollbar overflow-x-auto border-t border-edge px-2">
                    <ul className="flex min-w-max gap-1">
                        {tabs.map((tab) => {
                            const active = isTabActive(tab.href);
                            return (
                                <li key={tab.href}>
                                    <Link
                                        href={tab.href}
                                        aria-current={active ? "page" : undefined}
                                        className={cn(TAB_BASE, active ? TAB_ACTIVE : TAB_IDLE)}
                                    >
                                        {tab.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </header>

            {/* Content (the specific tab page) */}
            {children}
        </>
    );
}
