"use client";
import { ReactNode, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePatient } from "../PatientProvider";
import { uploadProfilePhoto } from "@/lib/api";

const getAge = (dobString?: string) => {
    if (!dobString) return "N/A";
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return dobString;
    const diff = Date.now() - dob.getTime();
    const age = new Date(diff);
    return Math.abs(age.getUTCFullYear() - 1970);
};

export default function ProfileLayout({ children }: { children: ReactNode }) {
    const { patient, loading, error, refresh } = usePatient();
    const pathname = usePathname();
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <span className="material-icons animate-spin text-primary text-3xl">sync</span>
            </div>
        );
    }

    if (error || !patient) {
        return (
            <div className="mb-4 p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm text-center">
                {error || "Patient record could not be found."}
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

    return (
        <>
            {/* Patient Header Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 mb-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    {/* Avatar and Basic Info */}
                    <div className="flex items-start gap-4">
                        <div className="relative group">
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm flex-shrink-0 overflow-hidden">
                                {patient.profilePhotoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={patient.profilePhotoUrl}
                                        alt={patient.fullName || patient.firstName || "Patient"}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="material-icons text-slate-400 text-3xl md:text-4xl">person</span>
                                )}
                                {uploadingPhoto && (
                                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                        <span className="material-icons animate-spin text-primary text-xl">sync</span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-1 -right-1 bg-primary text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center border-2 border-white"
                                title="Upload Profile Photo"
                            >
                                <span className="material-icons text-xs">photo_camera</span>
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handlePhotoUpload}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">
                                    {patient.fullName || `${patient.firstName} ${patient.lastName}`}
                                </h1>
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded tracking-wider flex-shrink-0">
                                    Active
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 mb-3">
                                Patient ID: <span className="font-mono font-bold text-primary">{patientParamId}</span>
                            </p>
                            {/* Quick Info Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                                <div>
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">DOB / Age</p>
                                    <p className="text-sm font-bold text-slate-900">{patient.dob ? `${patient.dob} (${getAge(patient.dob)}y)` : "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Gender</p>
                                    <p className="text-sm font-bold text-slate-900 capitalize">{patient.gender || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Phone</p>
                                    <p className="text-sm font-bold text-slate-900">{patient.phoneNumber || patient.phone || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Blood Type</p>
                                    <p className="text-sm font-bold text-red-600">{patient.bloodGroup || "Unknown"}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Address</p>
                                    <p className="text-sm font-bold text-slate-900 truncate">{patient.address || "N/A"}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex md:flex-col gap-2 flex-shrink-0">
                        <Link
                            href={`/patients/${patientParamId}/edit`}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm"
                        >
                            <span className="material-icons text-base">edit</span>
                            <span className="hidden sm:inline">Edit</span>
                        </Link>
                        {patient.updatedAt && (
                            <p className="text-[10px] text-slate-400 italic hidden md:block text-right">
                                Last Updated: {new Date(patient.updatedAt as string | number).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                </div>
                {uploadError && (
                    <p className="mt-2 text-xs text-red-600 font-medium">{uploadError}</p>
                )}
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 mb-6 overflow-x-auto">
                <nav className="flex gap-6 min-w-max">
                    <Link
                        href={basePath}
                        className={`px-4 py-3 text-sm whitespace-nowrap ${isTabActive(basePath) ? 'border-b-2 border-primary text-primary font-bold' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 font-medium'}`}
                    >
                        Details
                    </Link>
                    <Link
                        href={`${basePath}/orders`}
                        className={`px-4 py-3 text-sm whitespace-nowrap ${isTabActive(`${basePath}/orders`) ? 'border-b-2 border-primary text-primary font-bold' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 font-medium'}`}
                    >
                        Orders
                    </Link>
                    <Link
                        href={`${basePath}/reports`}
                        className={`px-4 py-3 text-sm whitespace-nowrap ${isTabActive(`${basePath}/reports`) ? 'border-b-2 border-primary text-primary font-bold' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 font-medium'}`}
                    >
                        Reports
                    </Link>
                    <Link
                        href={`${basePath}/documents`}
                        className={`px-4 py-3 text-sm whitespace-nowrap ${isTabActive(`${basePath}/documents`) ? 'border-b-2 border-primary text-primary font-bold' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 font-medium'}`}
                    >
                        Documents
                    </Link>
                </nav>
            </div>

            {/* Content (The specific tab page) */}
            {children}
        </>
    );
}
