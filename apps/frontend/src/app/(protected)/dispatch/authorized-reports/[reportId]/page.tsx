"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import {
    getDispatchReport,
    dispatchReport,
    markDispatchAttemptDelivered,
    type ApiDeliveryMethod,
    type DispatchItemDetail,
} from "@/lib/api";
import { formatDisplayId } from "@/lib/format-id";

const methodConfig: Record<ApiDeliveryMethod, { icon: string; color: string; bg: string; label: string; detail: string }> = {
    EMAIL: { icon: "mail", color: "text-blue-700", bg: "bg-blue-50", label: "Email", detail: "patient@email.com" },
    SMS: { icon: "smartphone", color: "text-amber-700", bg: "bg-amber-50", label: "SMS", detail: "text message" },
    WHATSAPP: { icon: "chat", color: "text-green-700", bg: "bg-green-50", label: "WhatsApp", detail: "document link" },
    POST: { icon: "local_shipping", color: "text-indigo-700", bg: "bg-indigo-50", label: "Post", detail: "tracked delivery" },
    PRINT: { icon: "print", color: "text-emerald-700", bg: "bg-emerald-50", label: "Print", detail: "Lab Printer #2" },
    PORTAL: { icon: "language", color: "text-purple-700", bg: "bg-purple-50", label: "Patient Portal", detail: "portal.durdans.lk" },
};

const hospitalInfo = {
    name: "Durdans Hospital",
    tagline: "A Centre of Excellence in Healthcare",
    address: "3, Alfred Place, Colombo 03, Sri Lanka",
    phone: "+94 11 2140000",
    hotline: "+94 11 2140700",
    website: "www.durdans.com",
    email: "info@durdans.com",
    labName: "Department of Laboratory Medicine",
    labAccreditation: "ISO 15189 : 2012 Accredited Laboratory",
    regNo: "MOH/PVT/0042",
};

type ReportViewData = {
    reportId: string;
    patientName: string;
    patientId: string;
    patientAge: string;
    patientGender: string;
    patientDOB: string;
    referringDoctor: string;
    ward: string;
    testName: string;
    sampleId: string;
    sampleCollected: string;
    reportGenerated: string;
    authorizedBy: string;
    authorizedTime: string;
    deliveryMethods: ApiDeliveryMethod[];
    results: { parameter: string; result: string; unit: string; flag: string; referenceRange: string; isAbnormal: boolean }[];
    clinicalNote: string;
};

type JsPdfWithAutoTable = jsPDF & {
    lastAutoTable?: {
        finalY: number;
    };
};

type DispatchNotice = {
    tone: "success" | "warning" | "error";
    message: string;
};

const fallbackText = (value?: string | number | null) => {
    if (value === null || value === undefined || value === "") {
        return "N/A";
    }
    return String(value);
};

const formatDateTime = (value?: string | null) => {
    if (!value) {
        return "N/A";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }
    return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
};

const formatDate = (value?: string | null) => {
    if (!value) {
        return "N/A";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }
    return date.toLocaleDateString("en-GB", { dateStyle: "medium" });
};

const formatGender = (value?: string | null) => {
    if (!value) {
        return "N/A";
    }
    const normalized = value.toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const withDoctorPrefix = (value?: string | null) => {
    const cleaned = value?.trim();
    if (!cleaned) {
        return "N/A";
    }
    return cleaned.startsWith("Dr.") ? cleaned : `Dr. ${cleaned}`;
};

const buildDispatchNotice = (updated: DispatchItemDetail, requestedMethods: ApiDeliveryMethod[]): DispatchNotice => {
    const allAttempts = updated.attempts ?? [];
    const attempts = requestedMethods.flatMap((method) => {
        const attempt = [...allAttempts].reverse().find((candidate) => candidate.method === method);
        return attempt ? [attempt] : [];
    });
    const delivered = attempts.filter((attempt) => attempt.status === "DELIVERED").length;
    const sent = attempts.filter((attempt) => attempt.status === "SENT").length;
    const failed = attempts.filter((attempt) => attempt.status === "FAILED");
    const pending = attempts.filter((attempt) => attempt.status === "PENDING").length;

    if (failed.length > 0) {
        const failedMethods = failed.map((attempt) => methodConfig[attempt.method]?.label ?? attempt.method).join(", ");
        return {
            tone: delivered > 0 || sent > 0 || pending > 0 ? "warning" : "error",
            message: `Dispatch completed with ${failed.length} failed channel${failed.length > 1 ? "s" : ""}: ${failedMethods}.`,
        };
    }

    if (sent > 0 || pending > 0) {
        return {
            tone: "warning",
            message: `Dispatch queued: ${delivered} delivered, ${sent} sent for tracking, ${pending} pending.`,
        };
    }

    return {
        tone: "success",
        message: `Dispatch delivered through ${delivered} channel${delivered === 1 ? "" : "s"}.`,
    };
};

const showDispatchNotice = (notice: DispatchNotice) => {
    if (notice.tone === "success") {
        toast.success(notice.message);
        return;
    }
    if (notice.tone === "warning") {
        toast(notice.message, { icon: "!" });
        return;
    }
    toast.error(notice.message);
};

function mapDetailToReportData(detail: DispatchItemDetail): ReportViewData {
    const authorizedTime = formatDateTime(detail.authorizedAt);
    const supportedMethods: ApiDeliveryMethod[] = ["SMS", "EMAIL"];
    const configuredMethods = detail.preferredDeliveryMethods?.filter((method) =>
        supportedMethods.includes(method)
    );
    const methods = configuredMethods?.length ? configuredMethods : supportedMethods;
    const resultRows = detail.results?.length
        ? detail.results.map((row) => ({
            parameter: fallbackText(row.parameter),
            result: fallbackText(row.result),
            unit: fallbackText(row.unit),
            flag: row.flag && row.flag !== "NORMAL" ? row.flag : "N/A",
            referenceRange: fallbackText(row.referenceRange),
            isAbnormal: Boolean(row.abnormal),
        }))
        : [
            {
                parameter: "Summary",
                result: detail.artifactUri ? "Report artifact available" : "No parameter data available",
                unit: "",
                flag: "N/A",
                referenceRange: "N/A",
                isAbnormal: false,
            },
        ];

    return {
        reportId: formatDisplayId(detail.reportReference, "REP"),
        patientName: detail.patientDisplayName,
        patientId: fallbackText(detail.patientCode),
        patientAge: detail.patientAge == null ? "N/A" : `${detail.patientAge}Y`,
        patientGender: formatGender(detail.patientGender),
        patientDOB: formatDate(detail.patientDob),
        referringDoctor: withDoctorPrefix(detail.referringDoctor),
        ward: fallbackText(detail.ward),
        testName: detail.testPanelLabel,
        sampleId: fallbackText(detail.sampleId),
        sampleCollected: formatDateTime(detail.sampleCollectedAt),
        reportGenerated: formatDateTime(detail.reportGeneratedAt || detail.authorizedAt),
        authorizedBy: withDoctorPrefix(detail.authorizedBy),
        authorizedTime,
        deliveryMethods: methods,
        results: resultRows,
        clinicalNote: fallbackText(detail.clinicalNote || (detail.artifactUri ? `Report artifact: ${detail.artifactUri}` : null)),
    };
}

export default function AuthorizedReportPage() {
    const router = useRouter();
    const params = useParams();
    const reportIdParam = decodeURIComponent(String(params.reportId ?? ""));

    const [detail, setDetail] = useState<DispatchItemDetail | null>(null);
    const [reportData, setReportData] = useState<ReportViewData | null>(null);
    const [loadError, setLoadError] = useState("");
    const [selectedMethods, setSelectedMethods] = useState<ApiDeliveryMethod[]>(["SMS", "EMAIL"]);
    const [overrideEmail, setOverrideEmail] = useState("");
    const [overridePhone, setOverridePhone] = useState("");
    const [overrideWhatsappPhone, setOverrideWhatsappPhone] = useState("");
    const [postalAddress, setPostalAddress] = useState("");
    const [postalService, setPostalService] = useState("Durdans Post Service");
    const [trackingNumber, setTrackingNumber] = useState("");
    const [dispatched, setDispatched] = useState(false);
    const [dispatching, setDispatching] = useState(false);
    const [markingAttemptId, setMarkingAttemptId] = useState<string | null>(null);
    const [dispatchNotice, setDispatchNotice] = useState<DispatchNotice | null>(null);

    const load = useCallback(async () => {
        setLoadError("");
        try {
            const d = await getDispatchReport(reportIdParam);
            const mapped = mapDetailToReportData(d);
            setDetail(d);
            setReportData(mapped);
            setSelectedMethods(
                mapped.deliveryMethods.length
                    ? mapped.deliveryMethods
                    : (["SMS", "EMAIL"] as ApiDeliveryMethod[])
            );
            setDispatched(d.overallStatus === "DELIVERED");
        } catch {
            setLoadError("Could not load this report from the server.");
            setDetail(null);
            setReportData(null);
        }
    }, [reportIdParam]);

    useEffect(() => {
        void load();
    }, [load]);

    const toggleMethod = (method: ApiDeliveryMethod) => {
        setSelectedMethods((prev) =>
            prev.includes(method)
                ? prev.filter((m) => m !== method)
                : [...prev, method]
        );
    };

    const handleDispatch = async () => {
        if (!reportIdParam) return;
        if (selectedMethods.length === 0) {
            toast.error("Please select at least one delivery method.");
            return;
        }
        setDispatching(true);
        try {
            const updated = await dispatchReport(reportIdParam, {
                methods: selectedMethods,
                overrideEmail: overrideEmail.trim() || undefined,
                overridePhone: overridePhone.trim() || undefined,
                overrideWhatsappPhone: overrideWhatsappPhone.trim() || undefined,
                postalAddress: postalAddress.trim() || undefined,
                postalService: postalService.trim() || undefined,
                trackingNumber: trackingNumber.trim() || undefined,
            });
            setDetail(updated);
            setReportData(mapDetailToReportData(updated));
            setDispatched(updated.overallStatus === "DELIVERED");
            const notice = buildDispatchNotice(updated, selectedMethods);
            setDispatchNotice(notice);
            showDispatchNotice(notice);
        } catch (e) {
            console.error(e);
            const notice: DispatchNotice = {
                tone: "error",
                message: "Dispatch failed. Check the patient email/phone and try again.",
            };
            setDispatchNotice(notice);
            showDispatchNotice(notice);
        } finally {
            setDispatching(false);
        }
    };

    const handleMarkDelivered = async (attemptId: string) => {
        setMarkingAttemptId(attemptId);
        try {
            const updated = await markDispatchAttemptDelivered(attemptId);
            setDetail(updated);
            setReportData(mapDetailToReportData(updated));
            setDispatched(updated.overallStatus === "DELIVERED");
            const notice: DispatchNotice = {
                tone: "success",
                message: "Delivery attempt marked as delivered.",
            };
            setDispatchNotice(notice);
            showDispatchNotice(notice);
        } catch (e) {
            console.error(e);
            const notice: DispatchNotice = {
                tone: "error",
                message: "Could not mark this delivery as delivered.",
            };
            setDispatchNotice(notice);
            showDispatchNotice(notice);
        } finally {
            setMarkingAttemptId(null);
        }
    };

    if (loadError || !reportData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-slate-500 text-sm gap-2">
                <p>{loadError || "Loading…"}</p>
                <button
                    type="button"
                    onClick={() => router.push("/dispatch/dashboard")}
                    className="text-primary font-semibold"
                >
                    Back to dashboard
                </button>
            </div>
        );
    }

    // ── PDF Download ──────────────────────────────────────────
    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // ── Header Background ──
        doc.setFillColor(30, 111, 217);
        doc.rect(0, 0, pageWidth, 38, "F");

        // ── Hospital Name ──
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(hospitalInfo.name.toUpperCase(), 14, 13);

        // ── Tagline ──
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 220, 255);
        doc.text(hospitalInfo.tagline, 14, 19);

        // ── Lab Name ──
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(hospitalInfo.labName, 14, 26);
        doc.setFontSize(7);
        doc.setTextColor(200, 220, 255);
        doc.text(hospitalInfo.labAccreditation, 14, 31);

        // ── Report ID on right ──
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`Report ID: ${reportData.reportId}`, pageWidth - 14, 13, { align: "right" });
        doc.text(`Reg No: ${hospitalInfo.regNo}`, pageWidth - 14, 19, { align: "right" });

        // ── AUTHORIZED badge ──
        doc.setFillColor(255, 255, 255, 0.3);
        doc.setDrawColor(255, 255, 255);
        doc.roundedRect(pageWidth - 46, 23, 32, 8, 2, 2, "S");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("✓ AUTHORIZED", pageWidth - 30, 28.5, { align: "center" });

        // ── Contact info row ──
        doc.setFillColor(240, 246, 255);
        doc.rect(0, 38, pageWidth, 10, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(70, 100, 150);
        doc.text(`📍 ${hospitalInfo.address}`, 14, 44);
        doc.text(`📞 ${hospitalInfo.phone}  |  🌐 ${hospitalInfo.website}  |  ✉ ${hospitalInfo.email}`, pageWidth / 2, 44, { align: "center" });

        // ── Divider ──
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(14, 50, pageWidth - 14, 50);

        // ── Test Name Title ──
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(reportData.testName, 14, 58);

        // ── Patient Info Box ──
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 62, (pageWidth - 32) / 2 - 4, 44, 2, 2, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 62, (pageWidth - 32) / 2 - 4, 44, 2, 2, "S");

        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("PATIENT INFORMATION", 18, 68);

        const patientFields = [
            ["Name", reportData.patientName],
            ["Patient ID", reportData.patientId],
            ["Age / Gender", `${reportData.patientAge} / ${reportData.patientGender}`],
            ["Date of Birth", reportData.patientDOB],
            ["Referring Doctor", reportData.referringDoctor],
            ["Ward / Dept", reportData.ward],
        ];

        doc.setFont("helvetica", "normal");
        patientFields.forEach(([label, value], i) => {
            const y = 74 + i * 5.5;
            doc.setTextColor(148, 163, 184);
            doc.setFontSize(7);
            doc.text(label, 18, y);
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(7.5);
            doc.text(value, 52, y);
        });

        // ── Report Info Box ──
        const col2X = 14 + (pageWidth - 32) / 2 + 4;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(col2X, 62, (pageWidth - 32) / 2 - 4, 44, 2, 2, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(col2X, 62, (pageWidth - 32) / 2 - 4, 44, 2, 2, "S");

        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("REPORT INFORMATION", col2X + 4, 68);

        const reportFields = [
            ["Sample ID", reportData.sampleId],
            ["Test", reportData.testName],
            ["Collected", reportData.sampleCollected],
            ["Generated", reportData.reportGenerated],
            ["Authorized By", reportData.authorizedBy],
            ["Auth. Time", reportData.authorizedTime],
        ];

        doc.setFont("helvetica", "normal");
        reportFields.forEach(([label, value], i) => {
            const y = 74 + i * 5.5;
            doc.setTextColor(148, 163, 184);
            doc.setFontSize(7);
            doc.text(label, col2X + 4, y);
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(7.5);
            doc.text(value, col2X + 28, y);
        });

        // ── Results Table ──
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("TEST RESULTS", 14, 116);

        autoTable(doc, {
            startY: 119,
            head: [["Parameter", "Result", "Unit", "Flag", "Reference Range"]],
            body: reportData.results.map((r) => [
                r.parameter,
                r.result,
                r.unit,
                r.flag,
                r.referenceRange,
            ]),
            theme: "grid",
            headStyles: {
                fillColor: [30, 111, 217],
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: "bold",
                cellPadding: 4,
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 3.5,
                textColor: [30, 41, 59],
            },
            columnStyles: {
                1: { fontStyle: "bold" },
                3: { halign: "center" },
            },
            didParseCell: (data) => {
                if (data.section === "body") {
                    const row = reportData.results[data.row.index];
                    if (row?.isAbnormal) {
                        data.cell.styles.textColor = [220, 38, 38];
                        data.cell.styles.fillColor = [255, 248, 248];
                    }
                }
            },
            margin: { left: 14, right: 14 },
        });

        // ── Clinical Note ──
        const finalY = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? 119) + 8;
        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(253, 230, 138);
        doc.roundedRect(14, finalY, pageWidth - 28, 20, 2, 2, "FD");

        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(146, 64, 14);
        doc.text("CLINICAL NOTE", 18, finalY + 6);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 53, 15);
        const splitNote = doc.splitTextToSize(reportData.clinicalNote, pageWidth - 36);
        doc.text(splitNote, 18, finalY + 12);

        // ── Signature ──
        const sigY = finalY + 30;
        doc.setDrawColor(226, 232, 240);
        doc.line(14, sigY, pageWidth - 14, sigY);

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text("This report is digitally authorized and is valid without a physical signature.", 14, sigY + 6);

        doc.setFont("helvetica", "italic");
        doc.setFontSize(12);
        doc.setTextColor(30, 111, 217);
        doc.text(reportData.authorizedBy, pageWidth - 14, sigY + 5, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("Authorized Pathologist", pageWidth - 14, sigY + 10, { align: "right" });

        // ── Footer ──
        const footerY = doc.internal.pageSize.getHeight() - 10;
        doc.setFillColor(30, 111, 217);
        doc.rect(0, footerY - 4, pageWidth, 14, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(255, 255, 255);
        doc.text(`${hospitalInfo.name}  •  ${hospitalInfo.address}  •  ${hospitalInfo.phone}`, pageWidth / 2, footerY + 3, { align: "center" });

        doc.save(`${reportData.reportId}_${reportData.patientName.replace(/ /g, "_")}.pdf`);
    };

    return (
        <div className="flex flex-col h-full space-y-6">

            {/* Top Bar */}
            <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <button
                        onClick={() => router.push("/dispatch/dashboard")}
                        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
                    >
                        <span className="material-icons text-[18px]">arrow_back</span>
                        Back
                    </button>
                    <div className="hidden sm:block w-px h-6 bg-slate-200" />
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Authorized Report
                        </span>
                        <span className="px-2.5 py-1 bg-slate-100/80 rounded-md text-xs font-bold text-slate-600 font-mono border border-slate-200">
                            {reportData.reportId}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 transition-colors flex-1 sm:flex-none"
                    >
                        <span className="material-icons text-[18px]">download</span>
                        Download PDF
                    </button>
                    <button
                        type="button"
                        disabled={dispatching || dispatched}
                        onClick={() => void handleDispatch()}
                        className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold border-none rounded-lg text-white transition-colors shadow-sm flex-1 md:w-48 whitespace-nowrap ${dispatched ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30" : "bg-primary hover:bg-primary/90 shadow-primary/30"}`}
                    >
                        <span className="material-icons text-[18px]">{dispatched ? "check_circle" : "send"}</span>
                        {dispatching ? "Dispatching…" : dispatched ? "Dispatched" : "Dispatch Report"}
                    </button>
                </div>
            </div>

            {dispatchNotice && (
                <div
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                        dispatchNotice.tone === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : dispatchNotice.tone === "warning"
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-red-200 bg-red-50 text-red-700"
                    }`}
                >
                    {dispatchNotice.message}
                </div>
            )}

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 pb-12">

                {/* LEFT — Report Preview */}
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col">

                    {/* Hospital Header */}
                    <div className="p-6 md:p-8 bg-gradient-to-br from-primary to-blue-800 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                        <div>
                            <div className="text-xl md:text-2xl font-black text-white tracking-wider uppercase">
                                {hospitalInfo.name}
                            </div>
                            <div className="text-[11px] md:text-xs text-white/80 mt-1 mb-3">
                                {hospitalInfo.tagline}
                            </div>
                            <div className="text-sm font-bold text-white/95">
                                {hospitalInfo.labName}
                            </div>
                            <div className="text-[10px] md:text-[11px] text-white/70 mt-0.5">
                                {hospitalInfo.labAccreditation}
                            </div>
                        </div>
                        <div className="sm:text-right">
                            <div className="text-[10px] text-white/70 uppercase tracking-widest mb-1">Report ID</div>
                            <div className="text-base md:text-lg font-bold text-white font-mono">
                                {reportData.reportId}
                            </div>
                            <div className="text-[10px] text-white/70 mt-1 mb-4">
                                Reg: {hospitalInfo.regNo}
                            </div>
                            <div className="inline-block px-3 py-1.5 bg-white/20 rounded-md border border-white/40 backdrop-blur-sm">
                                <span className="text-xs font-bold text-white tracking-widest">✓ AUTHORIZED</span>
                            </div>
                        </div>
                    </div>

                    {/* Hospital Contact Bar */}
                    <div className="bg-blue-50/50 p-3 md:px-8 border-b border-blue-100 flex flex-wrap items-center gap-4 md:gap-8 justify-center sm:justify-start">
                        <div className="flex items-center gap-2">
                            <span className="material-icons text-[14px] text-blue-700">location_on</span>
                            <span className="text-xs font-medium text-blue-800">{hospitalInfo.address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="material-icons text-[14px] text-blue-700">phone</span>
                            <span className="text-xs font-medium text-blue-800">{hospitalInfo.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="material-icons text-[14px] text-blue-700">language</span>
                            <span className="text-xs font-medium text-blue-800">{hospitalInfo.website}</span>
                        </div>
                    </div>

                    {/* Test Name */}
                    <div className="px-6 md:px-8 py-5 border-b border-slate-100 bg-slate-50/30">
                        <span className="text-lg font-bold text-slate-800">
                            {reportData.testName}
                        </span>
                    </div>

                    {/* Patient + Report Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-100">
                        <div className="p-6 md:px-8 border-b md:border-b-0 md:border-r border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                                Patient Information
                            </div>
                            <div className="flex flex-col gap-2.5">
                                {[
                                    { label: "Name", value: reportData.patientName },
                                    { label: "Patient ID", value: reportData.patientId },
                                    { label: "Age / Gender", value: `${reportData.patientAge} / ${reportData.patientGender}` },
                                    { label: "Date of Birth", value: reportData.patientDOB },
                                    { label: "Referring Dr", value: reportData.referringDoctor },
                                    { label: "Ward / Dept", value: reportData.ward },
                                ].map((item) => (
                                    <div key={item.label} className="flex">
                                        <span className="text-[11px] md:text-xs text-slate-500 w-28 shrink-0">{item.label}</span>
                                        <span className="text-[11px] md:text-xs font-bold text-slate-800">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 md:px-8">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                                Report Information
                            </div>
                            <div className="flex flex-col gap-2.5">
                                {[
                                    { label: "Sample ID", value: reportData.sampleId },
                                    { label: "Test", value: reportData.testName },
                                    { label: "Collected", value: reportData.sampleCollected },
                                    { label: "Generated", value: reportData.reportGenerated },
                                    { label: "Authorized By", value: reportData.authorizedBy },
                                    { label: "Auth. Time", value: reportData.authorizedTime },
                                ].map((item) => (
                                    <div key={item.label} className="flex">
                                        <span className="text-[11px] md:text-xs text-slate-500 w-28 shrink-0">{item.label}</span>
                                        <span className="text-[11px] md:text-xs font-bold text-slate-800">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Results Table */}
                    <div className="px-6 md:px-8 py-5 border-b border-slate-100 bg-slate-50/30">
                        <span className="text-sm font-bold text-slate-800 tracking-wide">TEST RESULTS</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    {["Parameter", "Result", "Unit", "Flag", "Reference Range"].map((h) => (
                                        <th key={h} className="px-6 md:px-8 py-3.5 border-b border-slate-200">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.results.map((row) => (
                                    <tr key={row.parameter} className={`border-b border-slate-100 ${row.isAbnormal ? "bg-red-50/20" : "bg-white"}`}>
                                        <td className="px-6 md:px-8 py-3.5 text-xs md:text-sm text-slate-700 font-semibold">{row.parameter}</td>
                                        <td className={`px-6 md:px-8 py-3.5 text-sm md:text-base font-bold ${row.isAbnormal ? "text-red-600" : "text-slate-800"}`}>{row.result}</td>
                                        <td className="px-6 md:px-8 py-3.5 text-[11px] md:text-xs text-slate-500">{row.unit}</td>
                                        <td className="px-6 md:px-8 py-3.5">
                                            {row.flag === "N/A" ? (
                                                <span className="text-slate-400 text-sm">N/A</span>
                                            ) : (
                                                <span className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-bold ${row.flag.includes("HIGH") ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-800"}`}>
                                                    {row.flag}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 md:px-8 py-3.5 text-[11px] md:text-xs text-slate-500">{row.referenceRange}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Clinical Note */}
                    <div className="p-6 md:px-8 border-t border-slate-100 bg-amber-50/30">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-icons text-[14px] text-amber-600">speaker_notes</span>
                            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">
                                Clinical Note
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-amber-900/80 leading-relaxed font-medium">
                            {reportData.clinicalNote}
                        </p>
                    </div>

                    {/* Signature Footer */}
                    <div className="p-6 md:px-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-50/50">
                        <div className="text-[10px] md:text-[11px] text-slate-400 leading-relaxed max-w-xs text-center sm:text-left">
                            This report is digitally authorized and is valid without a physical signature.
                        </div>
                        <div className="text-center sm:text-right">
                            <div className="text-lg md:text-xl text-primary italic font-serif opacity-90 mb-1">
                                {reportData.authorizedBy}
                            </div>
                            <div className="text-[10px] md:text-[11px] font-medium text-slate-500">Authorized Pathologist</div>
                        </div>
                    </div>

                    {/* Hospital Footer Bar */}
                    <div className="bg-primary/95 p-3 flex items-center justify-center">
                        <span className="text-[10px] text-white/80 font-medium tracking-wide">
                            {hospitalInfo.name} • {hospitalInfo.address} • {hospitalInfo.phone}
                        </span>
                    </div>
                </div>

                {/* RIGHT — Delivery Options */}
                <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-4 pb-3 border-b border-slate-100">
                            Select Delivery Methods
                        </h3>
                        <div className="flex flex-col gap-3">
                            {(["SMS", "EMAIL"] as ApiDeliveryMethod[]).map((method) => {
                                const m = methodConfig[method];
                                const isSelected = selectedMethods.includes(method);
                                return (
                                    <div
                                        key={method}
                                        onClick={() => toggleMethod(method)}
                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all duration-200 ${isSelected ? "border-primary bg-blue-50/50 ring-1 ring-primary/20" : "border-slate-200 bg-white hover:border-slate-300"}`}
                                    >
                                        <div className={`w-10 h-10 rounded-lg ${m.bg} flex items-center justify-center shrink-0`}>
                                            <span className={`material-icons text-[18px] ${m.color}`}>{m.icon}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-slate-700">{m.label}</div>
                                            <div className="text-[11px] text-slate-500 mt-0.5">{m.detail}</div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? "border-primary bg-primary" : "border-slate-300 bg-white"}`}>
                                            {isSelected && <span className="material-icons text-[14px] text-white">check</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                            {selectedMethods.includes("EMAIL") && (
                                <label className="block">
                                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Email override</span>
                                    <input
                                        type="email"
                                        value={overrideEmail}
                                        onChange={(e) => setOverrideEmail(e.target.value)}
                                        placeholder="Use patient email if blank"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </label>
                            )}
                            {selectedMethods.includes("SMS") && (
                                <label className="block">
                                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">SMS number</span>
                                    <input
                                        type="tel"
                                        value={overridePhone}
                                        onChange={(e) => setOverridePhone(e.target.value)}
                                        placeholder="Use patient phone if blank"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </label>
                            )}
                            {selectedMethods.includes("WHATSAPP") && (
                                <label className="block">
                                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">WhatsApp number</span>
                                    <input
                                        type="tel"
                                        value={overrideWhatsappPhone}
                                        onChange={(e) => setOverrideWhatsappPhone(e.target.value)}
                                        placeholder="Use SMS/patient phone if blank"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </label>
                            )}
                            {selectedMethods.includes("POST") && (
                                <div className="space-y-3">
                                    <label className="block">
                                        <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Postal address</span>
                                        <textarea
                                            value={postalAddress}
                                            onChange={(e) => setPostalAddress(e.target.value)}
                                            placeholder="Use patient address if blank"
                                            rows={3}
                                            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </label>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <label className="block">
                                            <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Post service</span>
                                            <input
                                                value={postalService}
                                                onChange={(e) => setPostalService(e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-slate-400">Tracking no.</span>
                                            <input
                                                value={trackingNumber}
                                                onChange={(e) => setTrackingNumber(e.target.value)}
                                                placeholder="Auto if blank"
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            disabled={dispatching || dispatched}
                            onClick={() => void handleDispatch()}
                            className={`w-full h-11 mt-6 text-sm font-bold border-none rounded-lg text-white transition-colors shadow-sm flex items-center justify-center gap-2 ${dispatched ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30" : "bg-primary hover:bg-primary/90 shadow-primary/30"}`}
                        >
                            <span className="material-icons text-[18px]">{dispatched ? "check_circle" : "send"}</span>
                            {dispatching ? "Dispatching…" : dispatched ? "Dispatched" : `Dispatch via ${selectedMethods.length} Method${selectedMethods.length !== 1 ? "s" : ""}`}
                        </button>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-4 pb-3 border-b border-slate-100">
                            Delivery Attempts
                        </h3>
                        {!detail?.attempts?.length ? (
                            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs font-medium text-slate-400">
                                No delivery attempts yet.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {detail.attempts.map((attempt) => {
                                    const m = methodConfig[attempt.method];
                                    const canMarkDelivered = attempt.status !== "DELIVERED" && attempt.status !== "FAILED";
                                    return (
                                        <div key={attempt.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                                            <div className="flex items-start gap-3">
                                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${m?.bg ?? "bg-slate-100"}`}>
                                                    <span className={`material-icons text-[16px] ${m?.color ?? "text-slate-500"}`}>{m?.icon ?? "send"}</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-sm font-bold text-slate-700">{m?.label ?? attempt.method}</span>
                                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${attempt.status === "DELIVERED" ? "bg-emerald-100 text-emerald-700" : attempt.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                                                            {attempt.status}
                                                        </span>
                                                    </div>
                                                    {attempt.recipientContact && (
                                                        <div className="mt-1 break-words text-[11px] font-medium text-slate-500">{attempt.recipientContact}</div>
                                                    )}
                                                    {attempt.trackingNumber && (
                                                        <div className="mt-2 text-[11px] font-bold text-slate-600">
                                                            Tracking:{" "}
                                                            {attempt.trackingUrl ? (
                                                                <a href={attempt.trackingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                                                    {attempt.trackingNumber}
                                                                </a>
                                                            ) : attempt.trackingNumber}
                                                        </div>
                                                    )}
                                                    {attempt.failureReason && (
                                                        <div className="mt-2 rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                                                            {attempt.failureReason}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {canMarkDelivered && (
                                                <button
                                                    type="button"
                                                    disabled={markingAttemptId === attempt.id}
                                                    onClick={() => void handleMarkDelivered(attempt.id)}
                                                    className="mt-3 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                                >
                                                    {markingAttemptId === attempt.id ? "Updating..." : "Mark Delivered"}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-5">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-4 pb-3 border-b border-slate-100">
                            Dispatch Summary
                        </h3>
                        <div className="flex flex-col gap-3">
                            {[
                                { label: "Report ID", value: reportData.reportId },
                                { label: "Patient", value: reportData.patientName },
                                { label: "Test", value: reportData.testName },
                                { label: "Authorized", value: reportData.authorizedTime },
                                { label: "Methods", value: selectedMethods.length > 0 ? selectedMethods.join(", ") : "None" },
                            ].map((item) => (
                                <div key={item.label} className="flex justify-between items-start gap-4">
                                    <span className="text-xs font-medium text-slate-500 shrink-0">{item.label}</span>
                                    <span className="text-xs font-bold text-slate-700 text-right">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
