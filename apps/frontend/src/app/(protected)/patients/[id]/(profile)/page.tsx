"use client";

import { useId, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Mail, Smartphone } from "lucide-react";
import { usePatient } from "../PatientProvider";
import { resendEmailVerification, sendPhoneOtp, verifyPhoneOtp } from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";
import SectionCard from "@/components/ui/SectionCard";
import PatientStatusBadge from "@/components/patient-dashboard/PatientStatusBadge";
import { formatPhone, formatRegistered, parsePatientCreatedAt } from "@/components/patient-dashboard/dashboard-data";

/** One label / value pair inside a definition-list card. */
function Detail({
    label,
    children,
    className,
    valueClassName,
}: {
    label: string;
    children: ReactNode;
    className?: string;
    valueClassName?: string;
}) {
    return (
        <div className={cn("min-w-0", className)}>
            <dt className="text-xs font-semibold text-fg-muted">{label}</dt>
            <dd className={cn("mt-0.5 break-words text-sm text-fg tabular-nums", valueClassName)}>{children}</dd>
        </div>
    );
}

const dash = (value?: string | null) => (value && value.trim() ? value : "—");

export default function PatientDetailsTab() {
    const { patient, refresh } = usePatient();
    const [resendingEmail, setResendingEmail] = useState(false);
    const [resendingSms, setResendingSms] = useState(false);
    const [verifyingSms, setVerifyingSms] = useState(false);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otpValue, setOtpValue] = useState("");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const otpHintId = useId();

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
            setMessage({ type: "success", text: "Verification email sent." });
        } catch (error) {
            setMessage({ type: "error", text: getErrorMessage(error) });
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
            setMessage({ type: "success", text: "OTP sent to the patient's phone." });
            setShowOtpInput(true);
        } catch (error) {
            setMessage({ type: "error", text: getErrorMessage(error) });
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
            setMessage({ type: "success", text: "Phone number verified." });
            setShowOtpInput(false);
            setOtpValue("");
            await refresh();
        } catch (error) {
            setMessage({ type: "error", text: getErrorMessage(error) });
            console.error(error);
        } finally {
            setVerifyingSms(false);
            setTimeout(() => setMessage(null), 5000);
        }
    };

    const primaryPhone = patient.phoneNumber || patient.phone;
    const registered = formatRegistered(parsePatientCreatedAt(patient));

    return (
        <div className="mb-8">
            {/* Persistent live region so async results are announced; the <p> carries the spacing.
                Single polite region for both outcomes — a nested role="alert" would double-announce errors. */}
            <div role="status" aria-live="polite" aria-atomic="true">
                {message && (
                    <p
                        className={cn(
                            "mb-4 flex items-start gap-2 rounded-md px-3 py-2 text-sm font-medium ring-1 ring-inset",
                            message.type === "success"
                                ? "bg-status-verified-bg text-status-verified-fg ring-status-verified-edge"
                                : "bg-status-danger-bg text-status-danger-fg ring-status-danger-edge"
                        )}
                    >
                        {message.type === "success" ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        ) : (
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                        <span className="min-w-0 break-words">{message.text}</span>
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                {/* Personal details */}
                <SectionCard title="Personal details">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <Detail label="Title">{dash(patient.title)}</Detail>
                        <Detail label="NIC / passport number">{dash(patient.identityNumber)}</Detail>
                        <Detail label="Nationality">{dash(patient.nationality)}</Detail>
                        <Detail label="Marital status">{dash(patient.maritalStatus)}</Detail>
                        <Detail label="Blood group" valueClassName="font-medium">
                            {dash(patient.bloodGroup)}
                        </Detail>
                        <Detail label="Registered">{registered}</Detail>
                    </dl>
                </SectionCard>

                {/* Contact */}
                <SectionCard title="Contact">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <Detail label="Primary phone" className="sm:col-span-2">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                <span>{formatPhone(primaryPhone)}</span>
                                {primaryPhone && (
                                    <PatientStatusBadge status={patient.phoneVerified ? "verified" : "pending"} />
                                )}
                                {primaryPhone && !patient.phoneVerified && !showOtpInput && (
                                    <Button
                                        size="sm"
                                        icon={Smartphone}
                                        onClick={handleSendSms}
                                        loading={resendingSms}
                                        className="focus-visible:ring-offset-surface"
                                    >
                                        {resendingSms ? "Sending…" : "Send OTP"}
                                    </Button>
                                )}
                            </div>
                            {showOtpInput && (
                                <div className="mt-3">
                                    {/* Hint lives below the whole row (still wired via aria-describedby) so the
                                        buttons can bottom-align with the 36px control and wrap cleanly without
                                        a fixed label-height offset. */}
                                    <div className="flex flex-wrap items-end gap-2">
                                        <InputField
                                            label="One-time code"
                                            aria-describedby={otpHintId}
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            maxLength={6}
                                            placeholder="123456"
                                            value={otpValue}
                                            onChange={(e) => setOtpValue(e.target.value)}
                                            className="w-36"
                                        />
                                        <div className="flex h-9 items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                onClick={handleVerifySms}
                                                loading={verifyingSms}
                                                disabled={verifyingSms || otpValue.length < 4}
                                                className="focus-visible:ring-offset-surface"
                                            >
                                                {verifyingSms ? "Verifying…" : "Verify"}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setShowOtpInput(false)}
                                                className="focus-visible:ring-offset-surface"
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                    <p id={otpHintId} className="mt-1 text-xs text-fg-muted">
                                        Enter the code sent by SMS
                                    </p>
                                </div>
                            )}
                        </Detail>
                        <Detail label="Alternative phone">{formatPhone(patient.alternatePhone)}</Detail>
                        <Detail label="Email" className="sm:col-span-2">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                <span className="break-all">{dash(patient.email)}</span>
                                {patient.email && (
                                    <PatientStatusBadge status={patient.emailVerified ? "verified" : "pending"} />
                                )}
                                {patient.email && !patient.emailVerified && (
                                    <Button
                                        size="sm"
                                        icon={Mail}
                                        onClick={handleResendEmail}
                                        loading={resendingEmail}
                                        className="focus-visible:ring-offset-surface"
                                    >
                                        {resendingEmail ? "Sending…" : "Resend email"}
                                    </Button>
                                )}
                            </div>
                        </Detail>
                        <Detail label="Address" className="sm:col-span-2" valueClassName="whitespace-pre-line">
                            {dash(patient.address)}
                        </Detail>
                    </dl>
                </SectionCard>

                {/* Emergency contact */}
                <SectionCard title="Emergency contact">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <Detail label="Contact person">{dash(patient.contactPersonName)}</Detail>
                        <Detail label="Contact number">{formatPhone(patient.contactPersonPhone)}</Detail>
                    </dl>
                </SectionCard>
            </div>
        </div>
    );
}
