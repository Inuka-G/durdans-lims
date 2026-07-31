"use client";

import { useState } from "react";
import { usePatient } from "../PatientProvider";
import { resendEmailVerification, sendPhoneOtp, verifyPhoneOtp } from "@/lib/api";

export default function PatientDetailsTab() {
    const { patient, refresh } = usePatient();
    const [resendingEmail, setResendingEmail] = useState(false);
    const [resendingSms, setResendingSms] = useState(false);
    const [verifyingSms, setVerifyingSms] = useState(false);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otpValue, setOtpValue] = useState("");
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    if (!patient) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getErrorMessage = (error: any) => {
        if (error.response?.data?.message) return error.response.data.message;
        if (error.response?.data?.error) return error.response.data.error;
        return "An unexpected error occurred.";
    };

    const handleResendEmail = async () => {
        if (!patient.patientCode) return;
        setResendingEmail(true);
        try {
            await resendEmailVerification(patient.patientCode);
            setMessage({ type: 'success', text: "Verification email sent successfully!" });
        } catch (error) {
            setMessage({ type: 'error', text: getErrorMessage(error) });
            console.error(error);
        } finally {
            setResendingEmail(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleSendSms = async () => {
        if (!patient.patientCode) return;
        setResendingSms(true);
        try {
            await sendPhoneOtp(patient.patientCode);
            setMessage({ type: 'success', text: "OTP sent to your phone!" });
            setShowOtpInput(true);
        } catch (error) {
            setMessage({ type: 'error', text: getErrorMessage(error) });
            console.error(error);
        } finally {
            setResendingSms(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const handleVerifySms = async () => {
        if (!patient.patientCode || !otpValue) return;
        setVerifyingSms(true);
        try {
            await verifyPhoneOtp(patient.patientCode, otpValue);
            setMessage({ type: 'success', text: "Phone number verified successfully!" });
            setShowOtpInput(false);
            setOtpValue("");
            await refresh();
        } catch (error) {
            setMessage({ type: 'error', text: getErrorMessage(error) });
            console.error(error);
        } finally {
            setVerifyingSms(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    return (
        <div className="space-y-6 mb-8">
            {message && (
                <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Personal Information Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm md:text-base">
                            <span className="material-icons text-primary text-lg md:text-xl">account_circle</span>
                            Personal Information
                        </h3>
                    </div>
                    <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Title</p>
                            <p className="text-sm text-slate-900 font-semibold">{patient.title || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">NIC / Passport Number</p>
                            <p className="text-sm text-slate-900 font-semibold">{patient.identityNumber || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Nationality</p>
                            <p className="text-sm text-slate-900 font-semibold">{patient.nationality || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Marital Status</p>
                            <p className="text-sm text-slate-900 font-semibold">{patient.maritalStatus || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Blood Group</p>
                            <p className="text-sm text-red-600 font-semibold">{patient.bloodGroup || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Registration Date</p>
                            <p className="text-sm text-slate-900 font-semibold">
                                {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : "N/A"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Contact & Emergency Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm md:text-base">
                            <span className="material-icons text-primary text-lg md:text-xl">contact_phone</span>
                            Contact &amp; Emergency
                        </h3>
                    </div>
                    <div className="p-4 md:p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Primary Phone</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm text-slate-900 font-semibold">{patient.phoneNumber || patient.phone || "N/A"}</p>
                                    {(patient.phone || patient.phoneNumber) && !patient.phoneVerified && !showOtpInput && (
                                        <button
                                            onClick={handleSendSms}
                                            disabled={resendingSms}
                                            className="text-[10px] font-bold text-primary hover:underline uppercase tracking-tight flex items-center gap-0.5"
                                        >
                                            {resendingSms ? 'Sending...' : 'Verify SMS'}
                                        </button>
                                    )}
                                    {patient.phoneVerified && (
                                        <span className="material-icons text-green-500 text-sm" title="Phone Verified">verified</span>
                                    )}
                                </div>
                                {showOtpInput && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <input
                                            type="text"
                                            maxLength={6}
                                            placeholder="Enter OTP"
                                            value={otpValue}
                                            onChange={(e) => setOtpValue(e.target.value)}
                                            className="w-24 px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-primary outline-none"
                                        />
                                        <button
                                            onClick={handleVerifySms}
                                            disabled={verifyingSms || otpValue.length < 4}
                                            className="px-3 py-1 bg-primary text-white text-[10px] font-bold rounded hover:bg-primary/90 disabled:bg-slate-300"
                                        >
                                            {verifyingSms ? '...' : 'Verify'}
                                        </button>
                                        <button
                                            onClick={() => setShowOtpInput(false)}
                                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Alternative Phone</p>
                                <p className="text-sm text-slate-900 font-semibold">{patient.alternatePhone || "N/A"}</p>
                            </div>
                            <div className="sm:col-span-2">
                                <p className="text-xs font-medium text-slate-500 mb-1">Email Address</p>
                                <div className="flex items-center gap-3">
                                    <p className="text-sm text-slate-900 font-semibold break-all">{patient.email || "N/A"}</p>
                                    {patient.email && !patient.emailVerified && (
                                        <button
                                            onClick={handleResendEmail}
                                            disabled={resendingEmail}
                                            className="text-[10px] font-bold text-primary hover:underline uppercase tracking-tight flex items-center gap-0.5"
                                        >
                                            {resendingEmail ? 'Sending...' : 'Verify Email'}
                                        </button>
                                    )}
                                    {patient.emailVerified && (
                                        <span className="material-icons text-green-500 text-sm" title="Email Verified">verified</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Residential Address</p>
                            <p className="text-sm text-slate-900 font-semibold">{patient.address || "N/A"}</p>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking_widest mb-3">Emergency Contact</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-medium text-slate-500 mb-1">Contact Person</p>
                                    <p className="text-sm text-slate-900 font-semibold">
                                        {patient.contactPersonName || "N/A"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-slate-500 mb-1">Contact Number</p>
                                    <p className="text-sm text-slate-900 font-semibold">{patient.contactPersonPhone || "N/A"}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
