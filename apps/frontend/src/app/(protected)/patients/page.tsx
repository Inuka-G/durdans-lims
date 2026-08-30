"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Building2, ChevronRight, Info, Search, SearchX, UserPlus, Users } from "lucide-react";
import { getPatients, Patient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { InputField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import PatientStatusBadge, { getPatientVerification } from "@/components/patient-dashboard/PatientStatusBadge";
import {
    calculateAge,
    formatGender,
    formatPhone,
    formatRegistered,
    parsePatientCreatedAt,
    patientInitials,
} from "@/components/patient-dashboard/dashboard-data";

const SKELETON_ROWS = 6;

function PatientsPageInner() {
    // Deep links such as /patients?keyword=0771234567 (from the dashboard) pre-fill and run the search.
    const initialKeyword = useSearchParams().get("keyword")?.trim() ?? "";
    const [searchQuery, setSearchQuery] = useState(initialKeyword);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const router = useRouter();
    // A search spans every branch, so results can include patients registered
    // elsewhere. Compare against the caller's own branch to label those rows.
    const { branchCode: myBranch, roles, user } = useAuth();
    // The term the current result set was loaded for ("" = own-branch list).
    const [activeQuery, setActiveQuery] = useState("");
    const searched = Boolean(activeQuery);

    useEffect(() => {
        if (roles.includes("PATIENT")) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const patientCode = (user as any)?.preferred_username;
            if (patientCode) {
                router.replace(`/patients/${patientCode}`);
            }
        }
    }, [roles, user, router]);

    const loadPatients = async (query = "") => {
        setLoading(true);
        setLoadError(null);
        setActiveQuery(query);
        try {
            // Adjust the params passed based on the backend API requirements
            const data = await getPatients(query ? { keyword: query } : {});
            const patientsList = Array.isArray(data) ? data : data.content || [];

            // Map backend PatientResponse to frontend Patient interface
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mappedPatients = patientsList.map((p: any) => {
                const nameParts = p.fullName ? p.fullName.split(" ") : [];
                return {
                    ...p,
                    id: p.patientCode,
                    firstName: nameParts[0] || "",
                    lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "",
                    phoneNumber: p.phone,
                };
            });
            setPatients(mappedPatients);
        } catch (error) {
            console.error("Failed to fetch patients", error);
            setLoadError(query ? `Couldn't search for "${query}".` : "Couldn't load patients for your branch.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Keep the visible input in sync with the result set when ?keyword changes
        // while this page stays mounted (e.g. dashboard deep link -> sidebar "Search patients").
        setSearchQuery(initialKeyword);
        loadPatients(initialKeyword);
    }, [initialKeyword]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadPatients(searchQuery);
    };

    const resultsTitle = searched ? "Search results" : "My branch";
    const resultsScope = searched ? `Across all branches for "${activeQuery}"` : "Your branch only";

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Search patients"
                crumbs={[{ label: "Patients", href: "/dashboard" }, { label: "Search" }]}
                meta={<span>Find an existing record before registering a new patient.</span>}
                actions={
                    <Button icon={UserPlus} href="/patients/new">
                        Register patient
                    </Button>
                }
            />

            {/* Live region for async state changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? searched
                        ? `Searching for ${activeQuery}`
                        : "Loading patients"
                    : loadError
                      ? loadError
                      : `${patients.length} ${patients.length === 1 ? "patient" : "patients"} ${searched ? "found" : "at your branch"}`}
            </p>

            {/* Search bar */}
            <div className="mb-4 rounded-lg border border-edge bg-surface p-4">
                <form className="flex flex-col gap-2 sm:flex-row sm:items-start" onSubmit={handleSearch} role="search">
                    <InputField
                        label="Search patients"
                        hideLabel
                        type="search"
                        name="keyword"
                        autoComplete="off"
                        placeholder="Patient ID, NIC, phone number or name"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1"
                    />
                    {/* Only block re-submits of an in-flight search; the initial branch-list load must not disable Enter/Search. */}
                    <Button type="submit" variant="primary" icon={Search} loading={loading && searched} className="sm:w-auto">
                        Search
                    </Button>
                </form>
                {!searched && (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-fg-muted">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
                        <span>
                            A search covers every branch — check here before registering a new patient. With no search
                            term the list below shows your own branch only.
                        </span>
                    </p>
                )}
            </div>

            {/* Results */}
            <SectionCard
                title={resultsTitle}
                count={loading ? undefined : patients.length}
                flush
                actions={<span className="truncate text-xs text-fg-muted">{resultsScope}</span>}
            >
                <div aria-busy={loading}>
                    {/* States that must not live inside the wide table */}
                    {loading ? (
                        <ul aria-hidden="true" className="divide-y divide-edge">
                            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                    <span className="h-7 w-7 shrink-0 rounded-full bg-skeleton" />
                                    <span className="h-3 w-40 rounded bg-skeleton" />
                                    <span className="hidden h-3 w-20 rounded bg-skeleton sm:block" />
                                    <span className="ml-auto hidden h-3 w-24 rounded bg-skeleton md:block" />
                                    <span className="hidden h-4 w-16 rounded bg-skeleton lg:block" />
                                </li>
                            ))}
                        </ul>
                    ) : loadError ? (
                        <EmptyState
                            icon={AlertTriangle}
                            title={loadError}
                            description="Check your connection and try again."
                            action={
                                <Button size="sm" onClick={() => loadPatients(activeQuery)}>
                                    Retry
                                </Button>
                            }
                        />
                    ) : patients.length === 0 ? (
                        searched ? (
                            <EmptyState
                                icon={SearchX}
                                title={`No patients match "${activeQuery}"`}
                                description="Searched every branch. Check the spelling or register the patient."
                                action={
                                    <Button size="sm" icon={UserPlus} href="/patients/new">
                                        Register patient
                                    </Button>
                                }
                            />
                        ) : (
                            <EmptyState
                                icon={Users}
                                title="No patients at your branch yet"
                                description="Search above to find a patient registered at another branch, or register a new one."
                                action={
                                    <Button size="sm" icon={UserPlus} href="/patients/new">
                                        Register patient
                                    </Button>
                                }
                            />
                        )
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                                <thead>
                                    <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                        {/* Widths sum to ~100% at the xl layout (22+12+12+8+12+10+11+10 = 97% + w-10 for Open). */}
                                        <th scope="col" className="w-[22%] py-2 pl-4 pr-3 font-semibold">Patient</th>
                                        <th scope="col" className="w-[12%] px-3 py-2 font-semibold">MRN</th>
                                        <th scope="col" className="hidden w-[12%] px-3 py-2 font-semibold lg:table-cell">NIC / passport</th>
                                        <th scope="col" className="w-[8%] px-3 py-2 font-semibold">Age / Sex</th>
                                        <th scope="col" className="w-[12%] px-3 py-2 font-semibold">Phone</th>
                                        <th scope="col" className="w-[10%] px-3 py-2 font-semibold">Branch</th>
                                        <th scope="col" className="hidden w-[11%] px-3 py-2 font-semibold xl:table-cell">Registered</th>
                                        <th scope="col" className="w-[10%] px-3 py-2 font-semibold">Status</th>
                                        <th scope="col" className="w-10 py-2 pl-2 pr-3">
                                            <span className="sr-only">Open</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {patients.map((patient: Patient) => {
                                        const code = patient.id || patient.patientId || "";
                                        const href = `/patients/${code}`;
                                        const name =
                                            `${patient.firstName || ""} ${patient.lastName || ""}`.trim() ||
                                            patient.fullName ||
                                            "Unnamed patient";
                                        const otherBranch = Boolean(
                                            patient.branchCode && myBranch && patient.branchCode !== myBranch
                                        );
                                        return (
                                            <tr key={code || patient.patientCode} className="group transition-colors hover:bg-surface-hover">
                                                <td className="py-2 pl-4 pr-3">
                                                    <Link
                                                        href={href}
                                                        className="flex min-w-0 items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                                    >
                                                        <span
                                                            aria-hidden="true"
                                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-skeleton text-[12px] font-semibold text-fg-secondary"
                                                        >
                                                            {patientInitials(name)}
                                                        </span>
                                                        <span className="min-w-0 truncate font-medium text-fg group-hover:text-primary-strong">
                                                            {name}
                                                        </span>
                                                    </Link>
                                                </td>
                                                <td className="truncate px-3 py-2 font-mono text-xs text-fg-secondary">
                                                    {patient.patientId || patient.id || "—"}
                                                </td>
                                                <td className="hidden truncate px-3 py-2 tabular-nums text-fg-secondary lg:table-cell">
                                                    {patient.identityNumber || "—"}
                                                </td>
                                                <td className="px-3 py-2 tabular-nums text-fg-secondary">
                                                    {calculateAge(patient.dob)}
                                                    <span className="text-fg-faint"> / </span>
                                                    {formatGender(patient.gender)}
                                                </td>
                                                <td className="px-3 py-2 tabular-nums text-fg-secondary">
                                                    {formatPhone(patient.phoneNumber || patient.phone)}
                                                </td>
                                                <td className="px-3 py-2 text-fg-secondary">
                                                    {patient.branchCode ? (
                                                        otherBranch ? (
                                                            <span
                                                                className="inline-flex max-w-full items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5 text-[12px] font-medium text-fg-secondary ring-1 ring-inset ring-edge"
                                                                title="Registered at another branch — you can still order tests for this patient"
                                                            >
                                                                <Building2 className="h-3 w-3 shrink-0 text-fg-muted" aria-hidden="true" />
                                                                <span className="truncate">{patient.branchCode}</span>
                                                                <span className="sr-only"> (other branch)</span>
                                                            </span>
                                                        ) : (
                                                            patient.branchCode
                                                        )
                                                    ) : (
                                                        <span className="text-fg-faint">—</span>
                                                    )}
                                                </td>
                                                <td className="hidden px-3 py-2 tabular-nums text-fg-secondary xl:table-cell">
                                                    {formatRegistered(parsePatientCreatedAt(patient))}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <PatientStatusBadge status={getPatientVerification(patient)} />
                                                </td>
                                                <td className="py-2 pl-2 pr-3 text-right">
                                                    <Link
                                                        href={href}
                                                        aria-label={`Open ${name}`}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover:text-fg-muted"
                                                    >
                                                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Footer */}
                    {!loading && !loadError && patients.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge px-4 py-2 text-xs text-fg-muted">
                            <span className="tabular-nums">
                                Showing {patients.length} {patients.length === 1 ? "patient" : "patients"}
                                {searched ? " across all branches" : " at your branch"}
                            </span>
                            {searched && (
                                <span>
                                    Not the right person?{" "}
                                    <Link
                                        href="/patients/new"
                                        className="rounded font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                        Register a new patient
                                    </Link>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </SectionCard>
        </div>
    );
}

export default function PatientsPage() {
    // useSearchParams needs a Suspense boundary for static prerendering.
    return (
        <Suspense fallback={null}>
            <PatientsPageInner />
        </Suspense>
    );
}
