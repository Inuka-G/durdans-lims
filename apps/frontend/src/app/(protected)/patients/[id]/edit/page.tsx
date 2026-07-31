"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updatePatient } from "@/lib/api";
import { usePatient } from "../PatientProvider";

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
        return (
            <div className="flex justify-center items-center py-12">
                <span className="material-icons animate-spin text-primary text-3xl">sync</span>
            </div>
        );
    }

    if (error || !patient) {
        return (
            <div className="p-8 text-center bg-red-50 text-red-600 rounded-xl border border-red-200">
                {error || "Patient not found."}
            </div>
        );
    }

    const patientParamId = patient.id || patient.patientId;

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
            router.push(`/patients/${patientParamId}`); // Redirect back to profile
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Failed to update patient", err);
            setSaveError(err.response?.data?.message || "An error occurred while updating the patient.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="pb-12">
            <div className="mb-6">
                <Link
                    href={`/patients/${patientParamId}`}
                    className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary transition-colors mb-4"
                >
                    <span className="material-icons text-base mr-1">arrow_back</span>
                    Back to Patient Profile
                </Link>
                <div className="flex items-end gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">Edit Patient Details</h1>
                    <p className="text-lg text-slate-400 mb-0.5">/ {patientParamId} - {patient.firstName} {patient.lastName}</p>
                </div>
            </div>

            {saveError && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">
                    {saveError}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
                        <span className="material-symbols-outlined text-primary">person</span>
                        <h2 className="text-base font-bold text-slate-900">Basic Information</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1">
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title</label>
                                <select
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                                >
                                    <option value="MR">Mr.</option>
                                    <option value="MRS">Mrs.</option>
                                    <option value="MS">Ms.</option>
                                    <option value="MISS">Miss</option>
                                    <option value="DR">Dr.</option>
                                    <option value="PROF">Prof.</option>
                                    <option value="REV">Rev.</option>
                                </select>
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">First Name</label>
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    required
                                    className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Last Name</label>
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                    className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date of Birth</label>
                            <input
                                type="date"
                                name="dob"
                                value={formData.dob}
                                onChange={handleChange}
                                className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                            >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">NIC / Passport Number (Read-only)</label>
                            <input
                                type="text"
                                value={formData.identityNumber || ""}
                                readOnly
                                className="w-full rounded-lg border-slate-200 bg-slate-100 text-sm text-slate-500 cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Blood Group</label>
                            <select
                                name="bloodGroup"
                                value={formData.bloodGroup}
                                onChange={handleChange}
                                className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                            >
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
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Marital Status</label>
                            <select
                                name="maritalStatus"
                                value={formData.maritalStatus}
                                onChange={handleChange}
                                className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                            >
                                <option value="">Select</option>
                                <option value="SINGLE">Single</option>
                                <option value="MARRIED">Married</option>
                                <option value="DIVORCED">Divorced</option>
                                <option value="WIDOWED">Widowed</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nationality</label>
                            <input
                                type="text"
                                name="nationality"
                                value={formData.nationality}
                                onChange={handleChange}
                                className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                            />
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
                        <span className="material-symbols-outlined text-primary">contact_phone</span>
                        <h2 className="text-base font-bold text-slate-900">Contact Details</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                            <input
                                type="tel"
                                name="phoneNumber"
                                value={formData.phoneNumber}
                                onChange={handleChange}
                                className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Alternative Phone / Home</label>
                            <input
                                type="tel"
                                name="alternatePhone"
                                value={formData.alternatePhone}
                                onChange={handleChange}
                                className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Emergency Contact Name</label>
                            <input
                                type="text"
                                name="contactPersonName"
                                value={formData.contactPersonName}
                                onChange={handleChange}
                                placeholder="Name of contact person"
                                className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Emergency Contact Phone</label>
                            <input
                                type="tel"
                                name="contactPersonPhone"
                                value={formData.contactPersonPhone}
                                onChange={handleChange}
                                placeholder="+94 7X XXX XXXX"
                                className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Residential Address</label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                rows={3}
                                className="w-full rounded-lg border-slate-300 bg-white text-sm focus:ring-primary focus:border-primary"
                            />
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
                        <span className="material-symbols-outlined text-primary">settings_applications</span>
                        <h2 className="text-base font-bold text-slate-900">System Information</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Patient ID</label>
                            <input
                                type="text"
                                value={patient.patientId || patient.id}
                                disabled
                                className="w-full rounded-lg border-slate-200 bg-slate-100 text-sm text-slate-500 cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Registration Date</label>
                            <input
                                type="text"
                                value={patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : ""}
                                disabled
                                className="w-full rounded-lg border-slate-200 bg-slate-100 text-sm text-slate-500 cursor-not-allowed"
                            />
                        </div>
                    </div>
                </section>

                <div className="flex items-center justify-end gap-4 pt-6">
                    <Link
                        href={`/patients/${patientParamId}`}
                        className="px-6 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-8 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? <span className="material-icons animate-spin text-sm">sync</span> : null}
                        {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}
