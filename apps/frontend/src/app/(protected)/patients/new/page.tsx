"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPatient, uploadPatientDocument } from "@/lib/api";
import { isAxiosError } from "axios";

export default function PatientRegistrationPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({
        title: "",
        firstName: "",
        lastName: "",
        dob: "",
        gender: "",
        identityType: "NIC",
        identityNumber: "", // NIC/Passport/Driving License
        phoneNumber: "",
        alternatePhone: "",
        email: "",
        address: ""
    });

    // Document Upload State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [documentType, setDocumentType] = useState("ID_VERIFICATION");
    const [docDescription, setDocDescription] = useState("");
    const [uploadProgress, setUploadProgress] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const parts = e.target.value.trim().split(" ");
        const firstName = parts[0] || "";
        const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
        setFormData(prev => ({ ...prev, firstName, lastName }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setUploadProgress("Creating patient record...");

        try {
            // 1. Create Patient
            const patientResponse = await createPatient(formData);
            const patientCode = patientResponse.patientCode;

            // 2. Upload Document if selected
            if (selectedFile && patientCode) {
                setUploadProgress("Uploading document...");
                await uploadPatientDocument(patientCode, documentType, selectedFile, docDescription);
            }

            setUploadProgress("Success!");
            // On success, redirect to patients list
            router.push("/patients");
        } catch (err) {
            console.error("Registration failed", err);
            setUploadProgress("");
            if (isAxiosError(err)) {
                const data = err.response?.data;
                if (data?.details && typeof data.details === 'object') {
                    // Extract all field errors
                    const fieldErrors = Object.entries(data.details)
                        .map(([field, msg]) => `${field}: ${msg}`)
                        .join(", ");
                    setError(`Input validation failed: ${fieldErrors}`);
                } else {
                    setError(data?.message || "Failed to register patient. Please try again.");
                }
            } else {
                setError("Failed to register patient. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-4">
                <nav className="flex text-xs font-medium text-slate-400 mb-2 gap-2 items-center">
                    <Link className="hover:text-primary transition-colors" href="/patients">Patient Management</Link>
                    <span className="material-icons text-[10px]">chevron_right</span>
                    <span className="text-slate-600">Register New Patient</span>
                </nav>
                <h1 className="text-2xl font-bold text-slate-900 font-outfit">Patient Registration</h1>
                <p className="text-slate-500 text-sm mt-1">Complete the fields below to create a new patient record.</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm flex items-center gap-3">
                    <span className="material-icons text-red-400">error</span>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Basic Info */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 pb-3 border-b border-slate-100">
                            <span className="material-icons text-primary text-xl">account_circle</span>
                            Basic Information
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="title">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                    id="title"
                                    name="title"
                                    required
                                    value={formData.title}
                                    onChange={handleChange}
                                >
                                    <option disabled value="">Select Title</option>
                                    <option value="MR">Mr.</option>
                                    <option value="MRS">Mrs.</option>
                                    <option value="MS">Ms.</option>
                                    <option value="MISS">Miss</option>
                                    <option value="DR">Dr.</option>
                                    <option value="PROF">Prof.</option>
                                    <option value="REV">Rev.</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="full_name">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900 placeholder:text-slate-400 text-sm"
                                    id="full_name"
                                    placeholder="Enter patient's full legal name"
                                    required
                                    type="text"
                                    onChange={handleFullNameChange}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="dob">
                                    Date of Birth <span className="text-red-500">*</span>
                                </label>
                                <input
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                    id="dob"
                                    name="dob"
                                    required
                                    type="date"
                                    max={new Date().toISOString().split("T")[0]}
                                    value={formData.dob}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="gender">
                                    Gender <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                    id="gender"
                                    name="gender"
                                    required
                                    value={formData.gender}
                                    onChange={handleChange}
                                >
                                    <option disabled value="">Select gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="identityType">
                                    Identity Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                    id="identityType"
                                    name="identityType"
                                    required
                                    value={formData.identityType}
                                    onChange={handleChange}
                                >
                                    <option value="NIC">Sri Lankan NIC</option>
                                    <option value="PASSPORT">Passport</option>
                                    <option value="DRIVING_LICENSE">Driving License</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="nic">
                                    Identity Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm uppercase"
                                    id="nic"
                                    name="identityNumber"
                                    placeholder={
                                        formData.identityType === 'NIC' ? "e.g. 199012345678 or 921234567V" :
                                            formData.identityType === 'PASSPORT' ? "e.g. N1234567" :
                                                "e.g. B1234567"
                                    }
                                    required
                                    type="text"
                                    value={formData.identityNumber}
                                    onChange={handleChange}
                                    pattern={
                                        formData.identityType === 'NIC' ? "^([0-9]{9}[vVxX]|[0-9]{12})$" :
                                            formData.identityType === 'PASSPORT' ? "^[a-zA-Z]{1,2}[0-9]{7}$" :
                                                "^[a-zA-Z0-9]{7,10}$"
                                    }
                                    title={
                                        formData.identityType === 'NIC' ? "Must be 9 digits followed by V/X or 12 digits" :
                                            formData.identityType === 'PASSPORT' ? "Must have 1 or 2 letters followed by 7 digits" :
                                                "Must be 7-10 alphanumeric characters"
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contact Details */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 pb-3 border-b border-slate-100">
                            <span className="material-icons text-primary text-xl">contact_phone</span>
                            Contact Details
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="phoneNumber">
                                    Phone Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                    id="phoneNumber"
                                    name="phoneNumber"
                                    placeholder="e.g. 076XXXXXXX"
                                    required
                                    type="tel"
                                    pattern="^(?:0|\+94|94)7[01245678]\d{7}$"
                                    title="Sri Lankan mobile number: e.g. 0712345678 or +94712345678"
                                    value={formData.phoneNumber}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="alternatePhone">
                                    Alternative Phone / Home
                                </label>
                                <input
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                    id="alternatePhone"
                                    name="alternatePhone"
                                    placeholder="e.g. 011XXXXXXX"
                                    type="tel"
                                    pattern="^(?:0|\+94|94)[1-9]\d{8}$"
                                    title="Sri Lankan landline or mobile number: e.g. 0112345678 or +94112345678"
                                    value={formData.alternatePhone}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="email">
                                    Email Address
                                </label>
                                <input
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                                    id="email"
                                    name="email"
                                    placeholder="patient@example.com"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="address">
                                    Residential Address <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm min-h-[100px]"
                                    id="address"
                                    name="address"
                                    placeholder="Enter complete residential address"
                                    required
                                    rows={3}
                                    value={formData.address}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {/* Document Upload */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 pb-3 border-b border-slate-100">
                            <span className="material-icons text-primary text-xl">upload_file</span>
                            Document Upload (Optional)
                        </h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Type</label>
                                    <select
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                        value={documentType}
                                        onChange={(e) => setDocumentType(e.target.value)}
                                    >
                                        <option value="LAB_REPORT_INTERNAL">Internal Lab Report</option>
                                        <option value="LAB_REPORT_EXTERNAL">External Lab Report</option>
                                        <option value="PRESCRIPTION">Prescription</option>
                                        <option value="MEDICAL_HISTORY">Medical History</option>
                                        <option value="ID_VERIFICATION">ID Verification</option>
                                        <option value="INSURANCE_DOCUMENT">Insurance Document</option>
                                        <option value="CONSENT_FORM">Consent Form</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Description</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                        placeholder="E.g. NIC Copy"
                                        value={docDescription}
                                        onChange={(e) => setDocDescription(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${selectedFile ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary hover:bg-slate-50'
                                }`}>
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                                />
                                <div className="flex flex-col items-center">
                                    <span className={`material-icons text-3xl mb-2 ${selectedFile ? 'text-primary' : 'text-slate-400'}`}>
                                        {selectedFile ? 'task' : 'cloud_upload'}
                                    </span>
                                    <p className="text-sm font-bold text-slate-700">
                                        {selectedFile ? selectedFile.name : 'Click or drag file to upload'}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG (Max 10MB)</p>
                                </div>
                            </div>

                            {uploadProgress && (
                                <div className="p-3 bg-primary/5 text-primary rounded-lg text-xs font-bold flex items-center gap-2 border border-primary/10">
                                    <span className="material-icons animate-spin text-sm">sync</span>
                                    {uploadProgress}
                                </div>
                            )}
                        </div>
                    </div>


                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                    <Link
                        href="/patients"
                        className="px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                    >
                        Cancel
                    </Link>
                    <button
                        className="px-8 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold text-sm shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="material-icons animate-spin text-sm">sync</span>
                        ) : (
                            <span className="material-icons text-sm">person_add_alt_1</span>
                        )}
                        {loading ? "Registering..." : "Register Patient"}
                    </button>
                </div>
            </form>


        </div>
    );
}
