"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { updatePatient } from "@/lib/api";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { FormSection, InputField, SelectField, TextareaField } from "@/components/ui/Field";
import EmptyState from "@/components/ui/EmptyState";
import { formatRegistered, parsePatientCreatedAt } from "@/components/patient-dashboard/dashboard-data";
import { usePatient } from "../PatientProvider";

/** Read-only controls: keep them focusable/copyable but visually muted. */
const READONLY_FIELD = "[&_input]:bg-surface-muted [&_input]:text-fg-muted";

function EditPatientSkeleton() {
    return (
        <div className="mx-auto max-w-5xl" role="status" aria-live="polite" aria-busy="true">
            <span className="sr-only">Loading patient…</span>
            <div className="mb-5 space-y-2">
                <div className="h-6 w-40 animate-pulse rounded bg-skeleton" />
                <div className="h-4 w-64 animate-pulse rounded bg-skeleton" />
            </div>
            <div className="space-y-4">
                {[8, 6, 2].map((fields, i) => (
                    <div key={i} className="rounded-lg border border-edge bg-surface p-4 sm:p-5">
                        <div className="mb-4 h-4 w-36 animate-pulse rounded bg-skeleton" />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {Array.from({ length: fields }).map((_, j) => (
                                <div key={j} className="space-y-1">
                                    <div className="h-3 w-24 animate-pulse rounded bg-skeleton" />
                                    <div className="h-9 w-full animate-pulse rounded-md bg-skeleton" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function EditPatientPage() {
    const { patient, loading, error, refresh } = usePatient();
    const router = useRouter();

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        dob: "",
        gender: "male",
        phoneNumber: "",
        alternatePhone: "",
        email: "",
        address: "",
        bloodGroup: "",
        maritalStatus: "",
        nationality: "",
        title: "MR",
        contactPersonName: "",
        contactPersonPhone: "",
        identityType: "",
        identityNumber: "",
    });

    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    useEffect(() => {
        if (patient) {
            setFormData({
                firstName: patient.firstName || "",
                lastName: patient.lastName || "",
                dob: patient.dob || "",
                gender: patient.gender || "male",
                phoneNumber: patient.phoneNumber || patient.phone || "",
                alternatePhone: patient.alternatePhone || "",
                email: patient.email || "",
                address: patient.address || "",
                bloodGroup: patient.bloodGroup || "",
                maritalStatus: patient.maritalStatus || "",
                nationality: patient.nationality || "",
                title: patient.title || "MR",
                contactPersonName: patient.contactPersonName || "",
                contactPersonPhone: patient.contactPersonPhone || "",
                identityType: patient.identityType || "",
                identityNumber: patient.identityNumber || "",
            });
        }
    }, [patient]);

    if (loading) {
        return <EditPatientSkeleton />;
    }

    if (error || !patient) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader title="Edit patient" />
                <div className="rounded-lg border border-edge bg-surface">
                    <p role="alert" className="sr-only">
                        {error || "Patient not found."}
                    </p>
                    <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load patient"
                        description={error || "Patient not found."}
                        action={
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <Button variant="primary" icon={RefreshCw} onClick={() => refresh()}>
                                    Retry
                                </Button>
                                <Button href="/patients" icon={ArrowLeft}>
                                    Back to patients
                                </Button>
                            </div>
                        }
                    />
                </div>
            </div>
        );
    }

    const patientParamId = patient.id || patient.patientId;
    const profileHref = `/patients/${patientParamId}`;
    const patientName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveError("");

        try {
            await updatePatient(patient.id as string, formData);
            await refresh(); // Refresh context
            router.push(profileHref); // Redirect back to profile
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Failed to update patient", err);
            setSaveError(err.response?.data?.message || "An error occurred while updating the patient.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-5xl">
            <PageHeader
                title="Edit patient"
                meta={
                    <>
                        <span className="tabular-nums">{patientParamId}</span>
                        {patientName && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="text-fg-secondary">{patientName}</span>
                            </>
                        )}
                    </>
                }
                actions={
                    <Button href={profileHref} icon={ArrowLeft}>
                        Back to profile
                    </Button>
                }
            />

            {saveError && (
                <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-lg border border-status-danger-edge bg-status-danger-bg px-3 py-2.5 text-sm text-status-danger-fg"
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{saveError}</span>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                    <FormSection title="Basic information" description="Name, date of birth and identity details.">
                        <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)]">
                            <SelectField label="Title" name="title" value={formData.title} onChange={handleChange}>
                                <option value="MR">Mr.</option>
                                <option value="MRS">Mrs.</option>
                                <option value="MS">Ms.</option>
                                <option value="MISS">Miss</option>
                                <option value="DR">Dr.</option>
                                <option value="PROF">Prof.</option>
                                <option value="REV">Rev.</option>
                            </SelectField>
                            <InputField
                                label="First name"
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                                autoComplete="given-name"
                            />
                            <InputField
                                label="Last name"
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                                autoComplete="family-name"
                            />
                        </div>

                        <InputField label="Date of birth" type="date" name="dob" value={formData.dob} onChange={handleChange} />

                        <SelectField label="Gender" name="gender" value={formData.gender} onChange={handleChange}>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </SelectField>

                        <InputField
                            label="NIC / passport number"
                            type="text"
                            value={formData.identityNumber || ""}
                            readOnly
                            aria-readonly="true"
                            hint="Read-only. Identity numbers can't be changed here."
                            className={READONLY_FIELD}
                        />

                        <SelectField label="Blood group" name="bloodGroup" value={formData.bloodGroup} onChange={handleChange}>
                            <option value="">Select</option>
                            <option value="A_POSITIVE">A+</option>
                            <option value="A_NEGATIVE">A-</option>
                            <option value="B_POSITIVE">B+</option>
                            <option value="B_NEGATIVE">B-</option>
                            <option value="O_POSITIVE">O+</option>
                            <option value="O_NEGATIVE">O-</option>
                            <option value="AB_POSITIVE">AB+</option>
                            <option value="AB_NEGATIVE">AB-</option>
                            <option value="UNKNOWN">Unknown</option>
                        </SelectField>

                        <SelectField label="Marital status" name="maritalStatus" value={formData.maritalStatus} onChange={handleChange}>
                            <option value="">Select</option>
                            <option value="SINGLE">Single</option>
                            <option value="MARRIED">Married</option>
                            <option value="DIVORCED">Divorced</option>
                            <option value="WIDOWED">Widowed</option>
                            <option value="OTHER">Other</option>
                        </SelectField>

                        <InputField
                            label="Nationality"
                            type="text"
                            name="nationality"
                            value={formData.nationality}
                            onChange={handleChange}
                            autoComplete="country-name"
                        />
                    </FormSection>

                    <FormSection title="Contact details" description="How to reach the patient and who to call in an emergency.">
                        <InputField
                            label="Phone number"
                            type="tel"
                            name="phoneNumber"
                            value={formData.phoneNumber}
                            onChange={handleChange}
                            autoComplete="tel"
                            inputMode="tel"
                        />
                        <InputField
                            label="Alternative phone / home"
                            type="tel"
                            name="alternatePhone"
                            value={formData.alternatePhone}
                            onChange={handleChange}
                            inputMode="tel"
                        />
                        <InputField
                            label="Email address"
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            autoComplete="email"
                            inputMode="email"
                        />
                        <InputField
                            label="Emergency contact name"
                            type="text"
                            name="contactPersonName"
                            value={formData.contactPersonName}
                            onChange={handleChange}
                            placeholder="Name of contact person"
                        />
                        <InputField
                            label="Emergency contact phone"
                            type="tel"
                            name="contactPersonPhone"
                            value={formData.contactPersonPhone}
                            onChange={handleChange}
                            placeholder="+94 7X XXX XXXX"
                            inputMode="tel"
                        />
                        <TextareaField
                            label="Residential address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            rows={3}
                            className="sm:col-span-2"
                        />
                    </FormSection>

                    <FormSection title="System information" description="Assigned by the system and not editable.">
                        <InputField label="Patient ID" type="text" value={patient.patientId || patient.id || ""} disabled />
                        <InputField
                            label="Registration date"
                            type="text"
                            value={formatRegistered(parsePatientCreatedAt(patient))}
                            disabled
                        />
                    </FormSection>
                </div>

                <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-end gap-2 border-t border-edge bg-canvas py-3">
                    <Button href={profileHref}>Cancel</Button>
                    <Button type="submit" variant="primary" loading={isSaving}>
                        {isSaving ? "Saving…" : "Save changes"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
