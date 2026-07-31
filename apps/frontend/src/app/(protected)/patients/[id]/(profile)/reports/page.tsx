"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getPatientReports, type DispatchDashboardItem } from "@/lib/api";
import { usePatient } from "../../PatientProvider";

const STATUS_STYLES: Record<string, string> = {
    PENDING: "border bg-amber-50 text-amber-700 border-amber-100",
    PARTIAL: "border bg-blue-50 text-blue-700 border-blue-100",
    DELIVERED: "border bg-green-50 text-green-700 border-green-100",
    FAILED: "border bg-red-50 text-red-700 border-red-100",
};

function formatReportDate(report: DispatchDashboardItem) {
    const dateValue = report.authorizedDate;
    const timeValue = report.authorizedTime;

    if (!dateValue && !timeValue) return "-";

    const parsed = dateValue && timeValue ? new Date(`${dateValue}T${timeValue}`) : new Date(dateValue || timeValue);
    if (Number.isNaN(parsed.getTime())) {
        return [dateValue, timeValue].filter(Boolean).join(", ");
    }

    return parsed.toLocaleString("en-LK", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatStatus(value?: string | null) {
    return value ? value.replace(/_/g, " ") : "-";
}

export default function PatientReportsTab() {
    const { patient } = usePatient();
    const [reports, setReports] = useState<DispatchDashboardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const patientCode = patient?.patientCode || patient?.id || "";

    const loadReports = useCallback(async () => {
        if (!patientCode) {
            setReports([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError("");
            const response = await getPatientReports(patientCode, 0, 50);
            setReports(response.content || []);
        } catch (loadError) {
            console.error("Failed to load patient reports", loadError);
            setError("Could not load this patient's laboratory reports.");
            setReports([]);
        } finally {
            setLoading(false);
        }
    }, [patientCode]);

    useEffect(() => {
        void loadReports();
    }, [loadReports]);

    if (!patient) return null;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="material-icons text-primary text-xl">description</span>
                    Laboratory Reports
                </h3>
                <button
                    onClick={loadReports}
                    className="border border-slate-200 bg-white text-slate-600 px-3 py-2 rounded text-sm font-semibold flex items-center gap-2 hover:bg-slate-50 transition-colors"
                >
                    <span className="material-icons text-sm">refresh</span>
                    Refresh
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                            <th className="px-6 py-4 border-b border-slate-100">Report ID</th>
                            <th className="px-6 py-4 border-b border-slate-100">Test / Panel Name</th>
                            <th className="px-6 py-4 border-b border-slate-100">Patient ID</th>
                            <th className="px-6 py-4 border-b border-slate-100">Authorized Date</th>
                            <th className="px-6 py-4 border-b border-slate-100 text-center">Delivery Status</th>
                            <th className="px-6 py-4 border-b border-slate-100 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                                    Loading patient reports...
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-sm text-red-500">
                                    {error}
                                </td>
                            </tr>
                        ) : reports.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                                    No laboratory reports found for this patient.
                                </td>
                            </tr>
                        ) : (
                            reports.map((report) => (
                                <tr key={report.id || report.reportId} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-semibold text-primary text-sm whitespace-nowrap">
                                        {report.reportId}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                        {report.testName || "-"}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {report.patientId || "-"}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                        {formatReportDate(report)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded tracking-wider ${STATUS_STYLES[report.status] ?? STATUS_STYLES.PENDING}`}>
                                            {formatStatus(report.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            href={`/dispatch/authorized-reports/${encodeURIComponent(report.reportId)}`}
                                            className="inline-flex items-center justify-end gap-1 text-primary hover:text-primary/80 text-sm font-bold"
                                        >
                                            View Report
                                            <span className="material-icons text-sm">open_in_new</span>
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500">Showing {reports.length} report{reports.length === 1 ? "" : "s"}</p>
            </div>
        </div>
    );
}
