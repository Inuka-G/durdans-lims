"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    CheckCircle2,
    Download,
    Globe,
    Inbox,
    Mail,
    MapPin,
    MessageCircle,
    NotebookPen,
    Phone,
    Printer,
    RotateCw,
    Send,
    Smartphone,
    Truck,
    type LucideIcon,
} from "lucide-react";
import {
    getDispatchReport,
    dispatchReport,
    markDispatchAttemptDelivered,
    type ApiDeliveryMethod,
    type DeliveryAttempt,
    type DispatchItemDetail,
} from "@/lib/api";
import { formatDisplayId } from "@/lib/format-id";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PageHeader, { type Crumb } from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip, { humanizeStatus, toneForStatus, type ChipTone } from "@/components/ui/StatusChip";
import { InputField, TextareaField } from "@/components/ui/Field";
import { formatAuditTime, formatPhone, formatRegistered } from "@/components/patient-dashboard/dashboard-data";

const AVAILABLE_DELIVERY_METHODS: ApiDeliveryMethod[] = [
    "EMAIL",
    "SMS",
    "PRINT",
    "POST",
    "WHATSAPP",
    "PORTAL",
];

const methodConfig: Record<ApiDeliveryMethod, { icon: LucideIcon; label: string; detail: string }> = {
    EMAIL: { icon: Mail, label: "Email", detail: "Patient's email address" },
    SMS: { icon: Smartphone, label: "SMS", detail: "Text message delivery" },
    PRINT: { icon: Printer, label: "Print", detail: "Front-desk counter pickup" },
    POST: { icon: Truck, label: "Post", detail: "Tracked postal delivery" },
    WHATSAPP: { icon: MessageCircle, label: "WhatsApp", detail: "WhatsApp document link" },
    PORTAL: { icon: Globe, label: "Patient portal", detail: "portal.durdans.lk release" },
};

const DISPATCH_CRUMBS: Crumb[] = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Dispatch", href: "/dispatch/dashboard" },
    { label: "Authorized reports", href: "/dispatch/authorized-reports" },
];

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
    /** Which action produced this notice — only "dispatch" notices may offer a re-dispatch retry. */
    source: "dispatch" | "attempt";
};

const NOTICE_CLASS: Record<DispatchNotice["tone"], string> = {
    success: "border-status-verified-edge bg-status-verified-bg text-status-verified-fg",
    warning: "border-status-pending-edge bg-status-pending-bg text-status-pending-fg",
    error: "border-status-danger-edge bg-status-danger-bg text-status-danger-fg",
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

const toDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
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
            source: "dispatch",
        };
    }

    if (sent > 0 || pending > 0) {
        return {
            tone: "warning",
            message: `Dispatch queued: ${delivered} delivered, ${sent} sent for tracking, ${pending} pending.`,
            source: "dispatch",
        };
    }

    return {
        tone: "success",
        message: `Dispatch delivered through ${delivered} channel${delivered === 1 ? "" : "s"}.`,
        source: "dispatch",
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

const getDispatchFlagTone = (flag?: string | null): ChipTone => {
    if (!flag) return "neutral";
    const norm = flag.toUpperCase();
    if (norm === "CRITICAL_HIGH" || norm === "CRITICAL_LOW" || norm.includes("CRITICAL")) return "danger";
    if (norm === "HIGH" || norm === "LOW") return "pending";
    if (norm === "NORMAL") return "neutral";
    return "neutral";
};

const getDispatchFlagLabel = (flag?: string | null): string => {
    if (!flag || flag === "N/A") return "—";
    const norm = flag.toUpperCase();
    if (norm === "CRITICAL_HIGH") return "Critical high";
    if (norm === "CRITICAL_LOW") return "Critical low";
    if (norm === "HIGH") return "High";
    if (norm === "LOW") return "Low";
    if (norm === "NORMAL") return "Normal";
    return humanizeStatus(flag);
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
            flag: row.flag ? row.flag : "NORMAL",
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

/** Label/value list used inside the printable report preview. */
function InfoList({ title, items }: { title: string; items: { label: string; value: string }[] }) {
    return (
        <div className="min-w-0">
            <h3 className="mb-3 text-xs font-semibold text-fg">{title}</h3>
            <dl className="flex min-w-0 flex-col gap-2">
                {items.map((item) => (
                    <div key={item.label} className="flex min-w-0 gap-3 text-xs">
                        <dt className="w-28 shrink-0 text-fg-muted">{item.label}</dt>
                        <dd className="min-w-0 flex-1 break-words font-medium text-fg">{item.value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
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
    const [dispatchFailed, setDispatchFailed] = useState(false);
    const [markingAttemptId, setMarkingAttemptId] = useState<string | null>(null);
    const [dispatchNotice, setDispatchNotice] = useState<DispatchNotice | null>(null);

    // Show the latest attempt per delivery channel for a clean and clear view (placed at top before early returns)
    const rawAttempts = detail?.attempts;
    const attempts = useMemo(() => {
        if (!rawAttempts || rawAttempts.length === 0) return [];
        const map = new Map<ApiDeliveryMethod, DeliveryAttempt>();
        rawAttempts.forEach((attempt) => {
            map.set(attempt.method, attempt);
        });
        return Array.from(map.values());
    }, [rawAttempts]);

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
            const notice = buildDispatchNotice(updated, selectedMethods);
            setDispatchNotice(notice);
            showDispatchNotice(notice);

            // Redirect back to Dispatch worklist
            setTimeout(() => {
                router.push("/dispatch/dashboard");
            }, 800);
        } catch (e) {
            console.error(e);
            setDispatchFailed(true);
            const notice: DispatchNotice = {
                tone: "error",
                message: "Dispatch failed. Check the patient email/phone and try again.",
                source: "dispatch",
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
                source: "attempt",
            };
            setDispatchNotice(notice);
            showDispatchNotice(notice);
        } catch (e) {
            console.error(e);
            const notice: DispatchNotice = {
                tone: "error",
                message: "Could not mark this delivery as delivered.",
                source: "attempt",
            };
            setDispatchNotice(notice);
            showDispatchNotice(notice);
        } finally {
            setMarkingAttemptId(null);
        }
    };

    // ── Error state ──────────────────────────────────────────
    if (loadError) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader title="Report" crumbs={[...DISPATCH_CRUMBS, { label: reportIdParam || "Report" }]} />
                <div role="alert" className="rounded-lg border border-edge bg-surface">
                    <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load report"
                        description={loadError}
                        action={
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <Button size="sm" icon={RotateCw} onClick={() => void load()}>
                                    Retry
                                </Button>
                                <Button size="sm" variant="ghost" icon={ArrowLeft} onClick={() => router.push("/dispatch/dashboard")}>
                                    Back to dashboard
                                </Button>
                            </div>
                        }
                    />
                </div>
            </div>
        );
    }

    // ── Loading state ────────────────────────────────────────
    if (!reportData) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader title="Report" crumbs={[...DISPATCH_CRUMBS, { label: "Loading…" }]} />
                <p role="status" aria-live="polite" className="sr-only">
                    Loading report
                </p>
                <div aria-hidden="true" className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="rounded-lg border border-edge bg-surface p-4">
                        <span className="block h-5 w-40 rounded bg-skeleton" />
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <span key={i} className="block h-4 rounded bg-skeleton" />
                            ))}
                        </div>
                        <div className="mt-6 space-y-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <span key={i} className="block h-8 rounded bg-skeleton" />
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-lg border border-edge bg-surface p-4">
                            <span className="block h-4 w-28 rounded bg-skeleton" />
                            <div className="mt-4 space-y-2">
                                {Array.from({ length: 2 }).map((_, i) => (
                                    <span key={i} className="block h-14 rounded bg-skeleton" />
                                ))}
                            </div>
                            <span className="mt-4 block h-9 rounded bg-skeleton" />
                        </div>
                        <div className="rounded-lg border border-edge bg-surface p-4">
                            <span className="block h-4 w-24 rounded bg-skeleton" />
                            <div className="mt-4 space-y-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <span key={i} className="block h-4 rounded bg-skeleton" />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── PDF Download ──────────────────────────────────────────
    // ── PDF Download ──────────────────────────────────────────
    const handleDownloadPDF = () => {
        if (!reportData) return;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // ── Top Header Banner ──
        doc.setFillColor(11, 31, 58); // Professional Durdans Navy
        doc.rect(0, 0, pageWidth, 36, "F");

        // ── Hospital Brand ──
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(hospitalInfo.name.toUpperCase(), 14, 13);

        // ── Tagline & Accreditation ──
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(190, 215, 250);
        doc.text(hospitalInfo.tagline, 14, 18.5);

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(hospitalInfo.labName, 14, 25);

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(190, 215, 250);
        doc.text(hospitalInfo.labAccreditation, 14, 30);

        // ── Report ID & Reg No on Right ──
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(`Report ID: ${reportData.reportId}`, pageWidth - 14, 13, { align: "right" });
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(190, 215, 250);
        doc.text(`Reg No: ${hospitalInfo.regNo}`, pageWidth - 14, 18.5, { align: "right" });

        // ── AUTHORIZED Badge (Clean ASCII) ──
        doc.setFillColor(255, 255, 255, 0.15);
        doc.setDrawColor(59, 130, 246);
        doc.roundedRect(pageWidth - 52, 22, 38, 9, 2, 2, "FD");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("AUTHORIZED", pageWidth - 33, 27.5, { align: "center" });

        // ── Contact Info Strip (Strict ASCII to avoid glyph corruptions) ──
        doc.setFillColor(241, 245, 249);
        doc.rect(0, 36, pageWidth, 9, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        const contactLine = `${hospitalInfo.address}   |   Tel: ${hospitalInfo.phone}   |   Web: ${hospitalInfo.website}   |   Email: ${hospitalInfo.email}`;
        doc.text(contactLine, pageWidth / 2, 42, { align: "center" });

        // ── Divider ──
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(14, 47, pageWidth - 14, 47);

        // ── Test Name Title ──
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(11, 31, 58);
        doc.text(reportData.testName, 14, 55);

        // ── Patient Info Box (Left Column) ──
        const colWidth = (pageWidth - 34) / 2;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 59, colWidth, 44, 2, 2, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, 59, colWidth, 44, 2, 2, "S");

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105);
        doc.text("PATIENT INFORMATION", 18, 65);

        const patientFields = [
            ["Name", reportData.patientName],
            ["Patient ID", reportData.patientId],
            ["Age / Gender", `${reportData.patientAge} / ${reportData.patientGender}`],
            ["Date of Birth", reportData.patientDOB],
            ["Referring Doctor", reportData.referringDoctor],
            ["Ward / Dept", reportData.ward],
        ];

        patientFields.forEach(([label, value], i) => {
            const y = 71 + i * 5.3;
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(7);
            doc.text(label, 18, y);

            doc.setFont("helvetica", i < 2 ? "bold" : "normal");
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(7.5);
            doc.text(value, 52, y);
        });

        // ── Report Info Box (Right Column) ──
        const col2X = 14 + colWidth + 6;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(col2X, 59, colWidth, 44, 2, 2, "F");
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(col2X, 59, colWidth, 44, 2, 2, "S");

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105);
        doc.text("REPORT INFORMATION", col2X + 4, 65);

        const reportFields = [
            ["Sample ID", reportData.sampleId],
            ["Test", reportData.testName],
            ["Collected", reportData.sampleCollected],
            ["Generated", reportData.reportGenerated],
            ["Authorized By", reportData.authorizedBy],
            ["Auth. Time", reportData.authorizedTime],
        ];

        reportFields.forEach(([label, value], i) => {
            const y = 71 + i * 5.3;
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(7);
            doc.text(label, col2X + 4, y);

            doc.setFont("helvetica", i === 0 || i === 4 ? "bold" : "normal");
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(7.5);
            doc.text(value, col2X + 28, y);
        });

        // ── Results Table Header ──
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(11, 31, 58);
        doc.text("TEST RESULTS", 14, 112);

        autoTable(doc, {
            startY: 115,
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
                fillColor: [11, 31, 58],
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
                0: { fontStyle: "bold" },
                1: { fontStyle: "bold" },
                3: { halign: "center" },
            },
            didParseCell: (data) => {
                if (data.section === "body") {
                    const row = reportData.results[data.row.index];
                    if (row?.isAbnormal) {
                        data.cell.styles.textColor = [220, 38, 38];
                        data.cell.styles.fillColor = [254, 242, 242];
                    }
                }
            },
            margin: { left: 14, right: 14 },
        });

        // ── Clinical Note ──
        const finalY = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? 115) + 6;
        if (reportData.clinicalNote && reportData.clinicalNote !== "N/A") {
            doc.setFillColor(255, 251, 235);
            doc.setDrawColor(253, 230, 138);
            doc.roundedRect(14, finalY, pageWidth - 28, 18, 2, 2, "FD");

            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(146, 64, 14);
            doc.text("CLINICAL NOTE", 18, finalY + 5.5);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(120, 53, 15);
            const splitNote = doc.splitTextToSize(reportData.clinicalNote, pageWidth - 36);
            doc.text(splitNote, 18, finalY + 11.5);
        }

        // ── Signature & Authorization Stamp ──
        const sigY = pageHeight - 34;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(14, sigY, pageWidth - 14, sigY);

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("This report is digitally authorized and is valid without a physical signature.", 14, sigY + 6);
        doc.text("Interpret results in conjunction with patient history and clinical findings.", 14, sigY + 10.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(11, 31, 58);
        doc.text(reportData.authorizedBy, pageWidth - 14, sigY + 6, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("Authorized Pathologist & Head of Lab", pageWidth - 14, sigY + 11, { align: "right" });

        // ── Footer ──
        const footerY = pageHeight - 9;
        doc.setFillColor(11, 31, 58);
        doc.rect(0, footerY - 3, pageWidth, 12, "F");
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(255, 255, 255);
        doc.text(`${hospitalInfo.name}   |   ${hospitalInfo.address}   |   ${hospitalInfo.phone}   |   Confidential Medical Report`, pageWidth / 2, footerY + 3, { align: "center" });

        doc.save(`${reportData.reportId}_${reportData.patientName.replace(/ /g, "_")}.pdf`);
    };

    const overallStatus = detail?.overallStatus ?? "PENDING";
    const authorizedDate = toDate(detail?.authorizedAt);
    const dispatchLabel = dispatching
        ? "Dispatching…"
        : dispatched
            ? "Dispatched"
            : dispatchFailed
                ? "Retry dispatch"
                : "Dispatch report";
    const dispatchIcon = dispatched ? CheckCircle2 : dispatchFailed ? RotateCw : Send;
    const selectedMethodLabels = selectedMethods.map((method) => methodConfig[method]?.label ?? method);

    return (
        <div className="mx-auto max-w-5xl">
            <PageHeader
                title={<span className="break-words">Report {reportData.reportId}</span>}
                crumbs={[...DISPATCH_CRUMBS, { label: reportData.reportId }]}
                meta={
                    <>
                        <StatusChip tone={toneForStatus(overallStatus)} dot>
                            {humanizeStatus(overallStatus)}
                        </StatusChip>
                        <span aria-hidden="true">·</span>
                        <span className="min-w-0 break-words">{reportData.patientName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="min-w-0 break-words">{reportData.testName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="min-w-0 break-words">
                            Authorized{" "}
                            {authorizedDate ? (
                                <time dateTime={authorizedDate.toISOString()} title={reportData.authorizedTime}>
                                    {formatRegistered(authorizedDate)}
                                </time>
                            ) : (
                                "—"
                            )}
                        </span>
                    </>
                }
                actions={
                    <>
                        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push("/dispatch/dashboard")}>
                            Back
                        </Button>
                        <Button icon={Download} onClick={handleDownloadPDF}>
                            Download PDF
                        </Button>
                        <Button
                            icon={dispatchIcon}
                            loading={dispatching}
                            disabled={dispatched}
                            onClick={() => void handleDispatch()}
                        >
                            {dispatchLabel}
                        </Button>
                    </>
                }
            />

            {dispatchNotice && (
                <div
                    role={dispatchNotice.tone === "error" ? "alert" : "status"}
                    className={cn(
                        "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium",
                        NOTICE_CLASS[dispatchNotice.tone]
                    )}
                >
                    <span className="min-w-0 break-words">{dispatchNotice.message}</span>
                    {dispatchNotice.source === "dispatch" && dispatchFailed && !dispatched && (
                        <Button size="sm" icon={RotateCw} loading={dispatching} onClick={() => void handleDispatch()}>
                            Retry
                        </Button>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                {/* LEFT — report preview + attempt history */}
                <div className="flex min-w-0 flex-col gap-4">
                    <SectionCard
                        title="Report preview"
                        flush
                        actions={
                            <StatusChip tone="success" dot>
                                Authorized
                            </StatusChip>
                        }
                    >
                        {/* Hospital header */}
                        <div className="flex flex-col gap-4 border-b border-edge bg-surface-muted px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                            <div className="min-w-0">
                                <p className="text-lg font-semibold tracking-tight text-primary-strong">{hospitalInfo.name}</p>
                                <p className="text-xs text-fg-muted">{hospitalInfo.tagline}</p>
                                <p className="mt-2 text-sm font-medium text-fg">{hospitalInfo.labName}</p>
                                <p className="text-xs text-fg-muted">{hospitalInfo.labAccreditation}</p>
                            </div>
                            <dl className="min-w-0 text-xs sm:text-right">
                                <dt className="text-fg-muted">Report ID</dt>
                                <dd className="break-words font-mono text-sm font-semibold text-fg" title={reportData.reportId}>
                                    {reportData.reportId}
                                </dd>
                                <dt className="mt-2 text-fg-muted">Registration</dt>
                                <dd className="font-medium text-fg">{hospitalInfo.regNo}</dd>
                            </dl>
                        </div>

                        {/* Hospital contact bar */}
                        <ul className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-edge px-4 py-2 text-xs text-fg-secondary sm:px-6">
                            <li className="flex min-w-0 items-center gap-1.5">
                                <MapPin className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                                <span className="min-w-0 break-words">{hospitalInfo.address}</span>
                            </li>
                            <li className="flex min-w-0 items-center gap-1.5">
                                <Phone className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                                <span className="min-w-0 break-words">{hospitalInfo.phone}</span>
                            </li>
                            <li className="flex min-w-0 items-center gap-1.5">
                                <Globe className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                                <span className="min-w-0 break-words">{hospitalInfo.website}</span>
                            </li>
                        </ul>

                        {/* Test name */}
                        <div className="min-w-0 border-b border-edge px-4 py-3 sm:px-6">
                            <h3 className="break-words text-base font-semibold text-fg">{reportData.testName}</h3>
                        </div>

                        {/* Patient + report info */}
                        <div className="grid grid-cols-1 gap-6 border-b border-edge px-4 py-4 sm:px-6 md:grid-cols-2">
                            <InfoList
                                title="Patient information"
                                items={[
                                    { label: "Name", value: reportData.patientName },
                                    { label: "Patient ID", value: reportData.patientId },
                                    { label: "Age / gender", value: `${reportData.patientAge} / ${reportData.patientGender}` },
                                    { label: "Date of birth", value: reportData.patientDOB },
                                    { label: "Referring doctor", value: reportData.referringDoctor },
                                    { label: "Ward / dept", value: reportData.ward },
                                ]}
                            />
                            <InfoList
                                title="Report information"
                                items={[
                                    { label: "Sample ID", value: reportData.sampleId },
                                    { label: "Test", value: reportData.testName },
                                    { label: "Collected", value: reportData.sampleCollected },
                                    { label: "Generated", value: reportData.reportGenerated },
                                    { label: "Authorized by", value: reportData.authorizedBy },
                                    { label: "Authorized at", value: reportData.authorizedTime },
                                ]}
                            />
                        </div>

                        {/* Results table */}
                        <div className="border-b border-edge px-4 py-3 sm:px-6">
                            <h3 className="text-sm font-semibold text-fg">Test results</h3>
                        </div>
                        <div className="overflow-x-auto">
                            {/* table-fixed: 140+100+110+160 = 510px of fixed columns; min-w 700 leaves the
                                auto-width Parameter column ≥ 190px at every breakpoint. */}
                            <table className="w-full min-w-[700px] table-fixed text-left text-sm">
                                <thead>
                                    <tr className="border-b border-edge text-xs font-semibold text-fg-muted">
                                        <th scope="col" className="py-2 pl-4 pr-3 font-semibold sm:pl-6">Parameter</th>
                                        <th scope="col" className="w-[140px] px-3 py-2 font-semibold">Result</th>
                                        <th scope="col" className="w-[100px] px-3 py-2 font-semibold">Unit</th>
                                        <th scope="col" className="w-[110px] px-3 py-2 font-semibold">Flag</th>
                                        <th scope="col" className="w-[160px] px-3 py-2 font-semibold">Reference range</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {reportData.results.map((row) => (
                                        <tr key={row.parameter} className={cn("hover:bg-surface-hover", row.isAbnormal && "bg-status-danger-bg/40")}>
                                            <td className="truncate py-2 pl-4 pr-3 font-medium text-fg sm:pl-6" title={row.parameter}>
                                                {row.parameter}
                                            </td>
                                            <td
                                                className={cn("truncate px-3 py-2 font-semibold tabular-nums", row.isAbnormal ? "text-status-danger-fg" : "text-fg")}
                                                title={row.result}
                                            >
                                                {row.result}
                                            </td>
                                            <td className="truncate px-3 py-2 text-fg-muted" title={row.unit || undefined}>{row.unit}</td>
                                            <td className="px-3 py-2">
                                                {row.flag === "N/A" || !row.flag ? (
                                                    <span className="text-fg-faint">—</span>
                                                ) : (
                                                    <StatusChip size="sm" dot tone={getDispatchFlagTone(row.flag)} title={getDispatchFlagLabel(row.flag)}>
                                                        {getDispatchFlagLabel(row.flag)}
                                                    </StatusChip>
                                                )}
                                            </td>
                                            <td className="truncate px-3 py-2 tabular-nums text-fg-muted" title={row.referenceRange}>
                                                {row.referenceRange}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Clinical note */}
                        <div className="min-w-0 border-t border-edge bg-surface-muted px-4 py-4 sm:px-6">
                            <div className="mb-1.5 flex items-center gap-1.5">
                                <NotebookPen className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                                <h3 className="text-xs font-semibold text-fg">Clinical note</h3>
                            </div>
                            {/* Free text — may be an artifact URI with no spaces, so it must wrap on any character. */}
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-secondary">
                                {reportData.clinicalNote}
                            </p>
                        </div>

                        {/* Signature footer */}
                        <div className="flex flex-col items-center justify-between gap-4 border-t border-edge px-4 py-4 sm:flex-row sm:px-6">
                            <p className="max-w-xs text-center text-xs text-fg-muted sm:text-left">
                                This report is digitally authorized and is valid without a physical signature.
                            </p>
                            <div className="min-w-0 text-center sm:text-right">
                                <p className="break-words font-serif text-lg italic text-primary-strong">{reportData.authorizedBy}</p>
                                <p className="text-xs text-fg-muted">Authorized pathologist</p>
                            </div>
                        </div>

                        {/* Hospital footer bar */}
                        <div className="rounded-b-lg border-t border-edge bg-surface-muted px-4 py-2 text-center text-[12px] text-fg-muted">
                            {hospitalInfo.name} · {hospitalInfo.address} · {hospitalInfo.phone}
                        </div>
                    </SectionCard>

                    <SectionCard title="Delivery attempts" count={attempts.length} flush>
                        {attempts.length === 0 ? (
                            <EmptyState
                                compact
                                icon={Inbox}
                                title="No delivery attempts yet"
                                description="Dispatch the report to create the first attempt."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                {/* table-fixed column budget — every column is explicitly sized so no column
                                    can collapse:
                                      base (<md, Updated hidden): 150+230+120+140+160        = 800px
                                      md+  (Updated shown):       150+230+120+140+120+160    = 920px
                                    min-w matches each band, so the card scrolls instead of squashing a column. */}
                                <table className="w-full min-w-[800px] table-fixed text-left text-sm md:min-w-[920px]">
                                    <thead>
                                        <tr className="border-b border-edge text-xs font-semibold text-fg-muted">
                                            <th scope="col" className="w-[150px] py-2 pl-4 pr-3 font-semibold">Method</th>
                                            <th scope="col" className="w-[230px] px-3 py-2 font-semibold">Recipient</th>
                                            <th scope="col" className="w-[120px] px-3 py-2 font-semibold">Status</th>
                                            <th scope="col" className="w-[140px] px-3 py-2 font-semibold">Tracking</th>
                                            <th scope="col" className="hidden w-[120px] px-3 py-2 font-semibold md:table-cell">Updated</th>
                                            <th scope="col" className="w-[160px] px-3 py-2 text-right font-semibold">
                                                <span className="sr-only">Actions</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-edge whitespace-nowrap">
                                        {attempts.map((attempt) => {
                                            const m = methodConfig[attempt.method];
                                            const MethodIcon = m?.icon ?? Send;
                                            const canMarkDelivered = attempt.status !== "DELIVERED" && attempt.status !== "FAILED";
                                            const isPhoneMethod = attempt.method === "SMS" || attempt.method === "WHATSAPP";
                                            const recipient = attempt.recipientContact
                                                ? isPhoneMethod
                                                    ? formatPhone(attempt.recipientContact)
                                                    : attempt.recipientContact
                                                : "—";
                                            const updatedAt = attempt.deliveredAt ?? attempt.dispatchedAt;
                                            return (
                                                <tr key={attempt.id} className="align-top hover:bg-surface-hover">
                                                    <td className="py-2 pl-4 pr-3">
                                                        <span className="flex min-w-0 items-center gap-2 font-medium text-fg">
                                                            <MethodIcon className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                                                            <span className="min-w-0 truncate" title={m?.label ?? attempt.method}>
                                                                {m?.label ?? attempt.method}
                                                            </span>
                                                        </span>
                                                    </td>
                                                    {/* Holds phone numbers and email addresses — unbreakable tokens, so the
                                                        cell wraps on any character rather than widening the table. */}
                                                    <td className="whitespace-normal break-words px-3 py-2 text-fg-secondary">
                                                        <span className="block min-w-0 break-words" title={attempt.recipientContact ?? undefined}>
                                                            {recipient}
                                                        </span>
                                                        {attempt.failureReason && (
                                                            <span
                                                                className="mt-1 block min-w-0 break-words text-[12px] text-status-danger-fg"
                                                                title={attempt.failureReason}
                                                            >
                                                                {attempt.failureReason}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <StatusChip
                                                            size="sm"
                                                            tone={attempt.status === "SENT" ? "info" : toneForStatus(attempt.status)}
                                                            dot
                                                            title={humanizeStatus(attempt.status)}
                                                        >
                                                            {humanizeStatus(attempt.status)}
                                                        </StatusChip>
                                                        {attempt.retryCount > 0 && (
                                                            <span className="mt-1 block text-[12px] tabular-nums text-fg-muted">
                                                                {attempt.retryCount} {attempt.retryCount === 1 ? "retry" : "retries"}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td
                                                        className="truncate px-3 py-2 font-mono text-xs text-fg-secondary"
                                                        title={attempt.trackingNumber ?? undefined}
                                                    >
                                                        {attempt.trackingNumber ? (
                                                            attempt.trackingUrl ? (
                                                                <a
                                                                    href={attempt.trackingUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="rounded text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                                >
                                                                    {attempt.trackingNumber}
                                                                </a>
                                                            ) : (
                                                                attempt.trackingNumber
                                                            )
                                                        ) : (
                                                            <span className="text-fg-faint">—</span>
                                                        )}
                                                    </td>
                                                    <td className="hidden truncate px-3 py-2 text-fg-muted md:table-cell">
                                                        {updatedAt ? (
                                                            <time dateTime={updatedAt} title={formatDateTime(updatedAt)}>
                                                                {formatAuditTime(updatedAt)}
                                                            </time>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right">
                                                        {canMarkDelivered && (
                                                            <Button
                                                                size="sm"
                                                                icon={Check}
                                                                loading={markingAttemptId === attempt.id}
                                                                onClick={() => void handleMarkDelivered(attempt.id)}
                                                            >
                                                                {markingAttemptId === attempt.id ? "Updating…" : "Mark delivered"}
                                                            </Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </SectionCard>
                </div>

                {/* RIGHT — delivery options + summary */}
                <div className="flex min-w-0 flex-col gap-4">
                    <SectionCard title="Delivery methods" count={selectedMethods.length}>
                        <fieldset>
                            <legend className="sr-only">Select delivery methods</legend>
                            <div className="flex flex-col gap-2">
                                {AVAILABLE_DELIVERY_METHODS.map((method) => {
                                    const m = methodConfig[method];
                                    const MethodIcon = m.icon;
                                    const isSelected = selectedMethods.includes(method);
                                    return (
                                        <label
                                            key={method}
                                            className={cn(
                                                "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors",
                                                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-surface",
                                                isSelected ? "border-primary bg-primary-soft" : "border-edge bg-surface hover:bg-surface-hover"
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={isSelected}
                                                onChange={() => toggleMethod(method)}
                                            />
                                            <span
                                                className={cn(
                                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                                                    isSelected ? "bg-primary-soft text-primary-strong" : "bg-surface-muted text-fg-secondary"
                                                )}
                                            >
                                                <MethodIcon className="h-4 w-4" aria-hidden="true" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-medium text-fg">{m.label}</span>
                                                <span className="block text-xs text-fg-muted">{m.detail}</span>
                                            </span>
                                            <span
                                                aria-hidden="true"
                                                className={cn(
                                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                                    isSelected ? "border-primary bg-primary text-white" : "border-edge-strong bg-surface"
                                                )}
                                            >
                                                {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>

                        <div className="mt-4 space-y-3 border-t border-edge pt-4">
                            {/* PRINT details & Action */}
                            {selectedMethods.includes("PRINT") && (
                                <div className="rounded-md border border-edge bg-surface-muted p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <span className="block text-xs font-semibold text-fg">Physical Report Printout</span>
                                            <span className="block text-xs text-fg-muted">Durdans Hospital Official Letterhead</span>
                                        </div>
                                        <Button size="sm" icon={Printer} onClick={handleDownloadPDF}>
                                            Print report
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* POST details & Action */}
                            {selectedMethods.includes("POST") && (
                                <div className="space-y-3 rounded-md border border-edge bg-surface-muted p-3">
                                    <div className="flex items-center justify-between gap-2 border-b border-edge pb-2.5">
                                        <div className="min-w-0">
                                            <span className="block text-xs font-semibold text-fg">Postal / Courier Package</span>
                                            <span className="block text-xs text-fg-muted">Print physical copy for envelope</span>
                                        </div>
                                        <Button size="sm" icon={Printer} onClick={handleDownloadPDF}>
                                            Print report
                                        </Button>
                                    </div>
                                    <TextareaField
                                        label="Delivery postal address"
                                        value={postalAddress}
                                        onChange={(e) => setPostalAddress(e.target.value)}
                                        rows={2}
                                        placeholder="e.g. No. 45, Alfred Place, Colombo 03"
                                        hint="Uses patient registered address if blank"
                                    />
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <InputField
                                            label="Postal / Courier service"
                                            value={postalService}
                                            onChange={(e) => setPostalService(e.target.value)}
                                            placeholder="e.g. Sri Lanka Post / Pronto"
                                        />
                                        <InputField
                                            label="Tracking / Waybill number"
                                            value={trackingNumber}
                                            onChange={(e) => setTrackingNumber(e.target.value)}
                                            placeholder="e.g. SLP-2026-9812"
                                            hint="Auto-generated if blank"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* EMAIL override */}
                            {selectedMethods.includes("EMAIL") && (
                                <InputField
                                    label="Alternate / Override Email"
                                    type="email"
                                    value={overrideEmail}
                                    onChange={(e) => setOverrideEmail(e.target.value)}
                                    placeholder="e.g. alternate@example.com"
                                    hint="Uses registered patient email if blank"
                                />
                            )}

                            {/* SMS override */}
                            {selectedMethods.includes("SMS") && (
                                <InputField
                                    label="Alternate / Override Phone Number"
                                    type="tel"
                                    value={overridePhone}
                                    onChange={(e) => setOverridePhone(e.target.value)}
                                    placeholder="e.g. +94 77 123 4567"
                                    hint="Uses registered patient phone if blank"
                                />
                            )}

                            {/* WHATSAPP override */}
                            {selectedMethods.includes("WHATSAPP") && (
                                <InputField
                                    label="Alternate / Override WhatsApp Number"
                                    type="tel"
                                    value={overrideWhatsappPhone}
                                    onChange={(e) => setOverrideWhatsappPhone(e.target.value)}
                                    placeholder="e.g. +94 77 123 4567"
                                    hint="Uses patient phone if blank"
                                />
                            )}

                            {/* PORTAL note */}
                            {selectedMethods.includes("PORTAL") && (
                                <div className="rounded-md border border-edge bg-surface-muted p-2.5 text-xs text-fg-secondary">
                                    🌐 Report will be released to the <span className="font-semibold text-fg">portal.durdans.lk</span> patient account.
                                </div>
                            )}
                        </div>

                        <Button
                            variant="primary"
                            icon={dispatchIcon}
                            loading={dispatching}
                            disabled={dispatched}
                            onClick={() => void handleDispatch()}
                            className="mt-4 w-full"
                        >
                            {dispatching
                                ? "Dispatching…"
                                : dispatched
                                    ? "Dispatched"
                                    : dispatchFailed
                                        ? "Retry dispatch"
                                        : `Dispatch via ${selectedMethods.length} method${selectedMethods.length !== 1 ? "s" : ""}`}
                        </Button>
                    </SectionCard>

                    <SectionCard title="Dispatch summary">
                        <dl className="flex flex-col gap-2.5">
                            {[
                                { label: "Report ID", value: reportData.reportId },
                                { label: "Patient", value: reportData.patientName },
                                { label: "Test", value: reportData.testName },
                                { label: "Authorized", value: reportData.authorizedTime },
                                { label: "Methods", value: selectedMethodLabels.length > 0 ? selectedMethodLabels.join(", ") : "None" },
                            ].map((item) => (
                                <div key={item.label} className="flex items-start justify-between gap-4 text-xs">
                                    <dt className="shrink-0 text-fg-muted">{item.label}</dt>
                                    <dd className="min-w-0 break-words text-right font-medium text-fg">{item.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}
