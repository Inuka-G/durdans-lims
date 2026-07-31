"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
    getPatients,
    Patient,
    getDashboardStatistics,
    DashboardStatistics,
    getMetadata,
    getAuditLogs,
    AuditLog,
} from "@/lib/api";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";

// --- Types ---
type TimeRange = "today" | "7d" | "30d" | "365d";
type StatusFilter = "all" | "verified" | "pending";

// --- Age calculator from DOB ---
function calculateAge(dob: string | undefined | null): string {
    if (!dob) return "—";
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return "—";
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 0 ? String(age) : "—";
}

function parsePatientCreatedAt(patient: Patient): Date | null {
    const value = patient.createdAt;
    if (value == null) return null;

    const date = typeof value === "number" ? new Date(value) : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatHourLabel(hour: number) {
    if (hour === 0) return "12AM";
    if (hour < 12) return `${hour}AM`;
    if (hour === 12) return "12PM";
    return `${hour - 12}PM`;
}

function monthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildRegistrationData(patients: Patient[], range: TimeRange) {
    const now = new Date();
    const createdDates = patients
        .map(parsePatientCreatedAt)
        .filter((date): date is Date => date !== null);

    if (range === "today") {
        const today = startOfLocalDay(now).getTime();
        return Array.from({ length: 8 }, (_, index) => {
            const startHour = index * 3;
            const endHour = startHour + 3;

            return {
                name: formatHourLabel(startHour),
                patients: createdDates.filter((date) =>
                    startOfLocalDay(date).getTime() === today &&
                    date.getHours() >= startHour &&
                    date.getHours() < endHour
                ).length,
            };
        });
    }

    if (range === "7d") {
        return Array.from({ length: 7 }, (_, index) => {
            const date = new Date(now);
            date.setDate(now.getDate() - (6 - index));
            const dayStart = startOfLocalDay(date).getTime();

            return {
                name: date.toLocaleDateString(undefined, { weekday: "short" }),
                patients: createdDates.filter((createdAt) => startOfLocalDay(createdAt).getTime() === dayStart).length,
            };
        });
    }

    if (range === "30d") {
        return Array.from({ length: 6 }, (_, index) => {
            const start = startOfLocalDay(new Date(now));
            start.setDate(now.getDate() - 29 + index * 5);
            const end = startOfLocalDay(new Date(start));
            end.setDate(start.getDate() + (index === 5 ? 5 : 4));
            end.setHours(23, 59, 59, 999);

            return {
                name: `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}-${end.toLocaleDateString(undefined, { day: "numeric" })}`,
                patients: createdDates.filter((date) => date >= start && date <= end).length,
            };
        });
    }

    return Array.from({ length: 12 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
        const key = monthKey(date);

        return {
            name: date.toLocaleDateString(undefined, { month: "short" }),
            patients: createdDates.filter((createdAt) => monthKey(createdAt) === key).length,
        };
    });
}

// --- Status colors for the donut chart ---
const STATUS_COLORS = ["#22c55e", "#f59e0b", "#94a3b8"];

const RANGE_LABELS: Record<TimeRange, string> = {
    today: "Today",
    "7d": "7 Days",
    "30d": "30 Days",
    "365d": "365 Days",
};

// --- Quick Actions ---
const quickActions = [
    {
        label: "Register Patient",
        icon: "person_add",
        href: "/patients/new",
        iconColor: "bg-primary/10 text-primary",
        cardBg: "bg-blue-50/60",
    },
    {
        label: "Search Patients",
        icon: "search",
        href: "/patients",
        iconColor: "bg-emerald-50 text-emerald-600",
        cardBg: "bg-emerald-50/50",
    },
    {
        label: "Daily Appointments",
        icon: "calendar_today",
        href: "https://www.durdans.com/appointments/",
        iconColor: "bg-violet-50 text-violet-600",
        cardBg: "bg-violet-50/50",
    },
    {
        label: "Audit Logs",
        icon: "history",
        href: "/audit",
        iconColor: "bg-amber-50 text-amber-600",
        cardBg: "bg-amber-50/50",
    },
];

type ActivityFeedItem = {
    id: string;
    message: string;
    time: string;
    dotColor: string;
};

const AUDIT_ACTIVITY_COLORS: Record<string, string> = {
    REGISTER_PATIENT: "bg-blue-500",
    UPDATE_PROFILE: "bg-rose-500",
    UPDATE_PROFILE_PHOTO: "bg-sky-500",
    UPLOAD_DOCUMENT: "bg-violet-500",
    DELETE_DOCUMENT: "bg-red-500",
    VERIFY_EMAIL: "bg-green-500",
    VERIFY_PHONE: "bg-green-500",
    SEND_OTP: "bg-amber-500",
    SEND_EMAIL_VERIFICATION: "bg-amber-500",
};

function parseAuditDetails(details?: string): Record<string, unknown> | null {
    if (!details) return null;
    try {
        const parsed = JSON.parse(details);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

function getStringDetail(details: Record<string, unknown> | null, key: string): string | undefined {
    const value = details?.[key];
    return typeof value === "string" && value.trim() ? value : undefined;
}

function formatAuditTime(timestamp: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Recently";

    return date.toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric",
    });
}

function getAuditSubject(log: AuditLog): string {
    const details = parseAuditDetails(log.details);
    return (
        getStringDetail(details, "patientName") ||
        getStringDetail(details, "fullName") ||
        log.patientCode ||
        log.entityId ||
        log.entityType ||
        "Record"
    );
}

function formatActionLabel(action: string): string {
    return action
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function toActivityFeedItem(log: AuditLog): ActivityFeedItem {
    const action = log.action?.toUpperCase() || "ACTIVITY";
    const subject = getAuditSubject(log);
    const actor = log.performedBy ? ` by ${log.performedBy}` : "";

    const actionMessages: Record<string, string> = {
        REGISTER_PATIENT: `"${subject}" registered${actor}`,
        UPDATE_PROFILE: `"${subject}" profile updated${actor}`,
        UPDATE_PROFILE_PHOTO: `"${subject}" profile photo updated${actor}`,
        UPLOAD_DOCUMENT: `"${subject}" document uploaded${actor}`,
        DELETE_DOCUMENT: `"${subject}" document deleted${actor}`,
        VERIFY_EMAIL: `"${subject}" email verified${actor}`,
        VERIFY_PHONE: `"${subject}" phone verified${actor}`,
        SEND_OTP: `OTP sent for "${subject}"${actor}`,
        SEND_EMAIL_VERIFICATION: `Email verification sent for "${subject}"${actor}`,
    };

    return {
        id: log.id || `${action}-${log.timestamp}`,
        message: actionMessages[action] || `${formatActionLabel(action)} for "${subject}"${actor}`,
        time: formatAuditTime(log.timestamp),
        dotColor: AUDIT_ACTIVITY_COLORS[action] || "bg-slate-500",
    };
}

export default function DashboardPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [stats, setStats] = useState<DashboardStatistics | null>(null);
    const [branchName, setBranchName] = useState<string>("Loading...");
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<TimeRange>("today");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [tableSearch, setTableSearch] = useState("");

    useEffect(() => {
        let active = true;

        async function loadAuditActivity() {
            try {
                const auditData = await getAuditLogs({ page: 0, size: 6 });
                if (active) setAuditLogs(auditData.content || []);
            } catch (auditError) {
                console.error("Failed to load dashboard activity", auditError);
                if (active) setAuditLogs([]);
            }
        }

        async function loadData() {
            try {
                const metadata = await getMetadata();
                if (active) setBranchName(metadata.currentBranchName);

                const [patientsData, statsData] = await Promise.all([
                    getPatients({ branchCode: metadata.currentBranchCode }),
                    getDashboardStatistics(metadata.currentBranchCode),
                ]);

                if (active) {
                    setPatients(
                        Array.isArray(patientsData) ? patientsData : patientsData.content || []
                    );
                    setStats(statsData);
                }

                await loadAuditActivity();
            } catch (error) {
                console.error("Failed to load dashboard data", error);
                if (active) setBranchName("Durdans Branch");
            } finally {
                if (active) setLoading(false);
            }
        }

        loadData();
        const activityRefresh = window.setInterval(loadAuditActivity, 30000);

        return () => {
            active = false;
            window.clearInterval(activityRefresh);
        };
    }, []);

    // --- Derived data ---
    const registrationChartData = useMemo(() => buildRegistrationData(patients, timeRange), [patients, timeRange]);

    const statusChartData = useMemo(() => {
        const verified = patients.filter((p) => p.emailVerified || p.phoneVerified).length;
        const pending = patients.filter((p) => !p.emailVerified && !p.phoneVerified).length;
        const total = patients.length;
        return [
            { name: "Verified", value: verified, color: STATUS_COLORS[0] },
            { name: "Pending", value: pending, color: STATUS_COLORS[1] },
            { name: "Unverified", value: Math.max(0, total - verified - pending), color: STATUS_COLORS[2] },
        ].filter((d) => d.value > 0);
    }, [patients]);

    const filteredPatients = useMemo(() => {
        let result = patients;
        if (statusFilter === "verified") {
            result = result.filter((p) => p.emailVerified || p.phoneVerified);
        } else if (statusFilter === "pending") {
            result = result.filter((p) => !p.emailVerified && !p.phoneVerified);
        }
        if (tableSearch.trim()) {
            const q = tableSearch.toLowerCase();
            result = result.filter(
                (p) =>
                    (p.fullName || "").toLowerCase().includes(q) ||
                    (p.patientCode || "").toLowerCase().includes(q) ||
                    (p.phone || p.phoneNumber || "").includes(q)
            );
        }
        return result;
    }, [patients, statusFilter, tableSearch]);

    const activityFeed = useMemo(() => {
        return auditLogs.slice(0, 6).map(toActivityFeedItem);
    }, [auditLogs]);

    const totalPatients = patients.length;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* ── Header ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 font-outfit">
                        {branchName} Patient Dashboard
                    </h1>
                    <p className="text-slate-500 text-base mt-0.5">
                        Overview of registration activities and patient flow.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Time range filter pills */}
                    <div className="flex bg-slate-100 rounded-lg p-1 gap-0.5">
                        {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
                            <button
                                key={r}
                                onClick={() => setTimeRange(r)}
                                className={`px-3.5 py-1.5 text-sm font-bold rounded-md transition-all ${timeRange === r
                                    ? "bg-white text-primary shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                    }`}
                            >
                                {RANGE_LABELS[r]}
                            </button>
                        ))}
                    </div>

                    <Link
                        href="/patients/new"
                        className="flex items-center gap-2 bg-black hover:bg-primary/90 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all shadow-lg shadow-primary/20"
                    >
                        <span className="material-icons text-base">person_add_alt_1</span>
                        Register New Patient
                    </Link>
                </div>
            </div>

            {/* ── KPI Cards (4 columns) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Card 1 — Registered Today */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <span className="material-icons text-xl">how_to_reg</span>
                        </div>
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                            +12% vs yesterday
                        </span>
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                        Registered Today
                    </p>
                    <p className="text-3xl font-extrabold text-slate-900 mt-0.5">
                        {stats?.patientsRegisteredToday ?? "--"}
                    </p>
                </div>

                {/* Card 2 — This Week */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                            <span className="material-icons text-xl">person_add</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            This Week
                        </span>
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                        New Patients
                    </p>
                    <p className="text-3xl font-extrabold text-slate-900 mt-0.5">
                        {stats?.newPatientsThisWeek ?? "--"}
                    </p>
                </div>

                {/* Card 3 — Pending Verifications */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-orange-400" />
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-orange-50 rounded-lg text-orange-500">
                            <span className="material-icons text-xl">pending_actions</span>
                        </div>
                        <button className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider">
                            Review All
                        </button>
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                        Pending Verifications
                    </p>
                    <p className="text-3xl font-extrabold text-orange-500 mt-0.5">
                        {stats ? String(stats.pendingVerifications).padStart(2, "0") : "--"}
                    </p>
                </div>

                {/* Card 4 — Total Patients */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-2 bg-violet-50 rounded-lg text-violet-600">
                            <span className="material-icons text-xl">groups</span>
                        </div>
                        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">
                            All Time
                        </span>
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                        Total Patients
                    </p>
                    <p className="text-3xl font-extrabold text-slate-900 mt-0.5">
                        {loading ? "--" : totalPatients.toLocaleString()}
                    </p>
                </div>
            </div>

            {/* ── Charts Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
                {/* Bar Chart — Patient Registrations */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <span className="material-icons text-primary text-lg">bar_chart</span>
                            Patient Registrations
                        </h2>
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
                            {RANGE_LABELS[timeRange]}
                        </span>
                    </div>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={registrationChartData} barSize={timeRange === "365d" ? 18 : 28}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    cursor={{ fill: "rgba(19,127,236,0.05)" }}
                                    contentStyle={{
                                        borderRadius: 8,
                                        border: "1px solid #e2e8f0",
                                        boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
                                        fontSize: 12,
                                    }}
                                />
                                <Bar
                                    dataKey="patients"
                                    fill="#137fec"
                                    radius={[6, 6, 0, 0]}
                                    name="Patients"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut Chart — Patient Status */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <span className="material-icons text-primary text-lg">donut_large</span>
                            Status Overview
                        </h2>
                    </div>
                    <div className="h-56 flex items-center justify-center">
                        {statusChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={80}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: 8,
                                            border: "1px solid #e2e8f0",
                                            boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
                                            fontSize: 12,
                                        }}
                                    />
                                    <Legend
                                        iconType="circle"
                                        iconSize={8}
                                        wrapperStyle={{ fontSize: 12, color: "#64748b" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center text-slate-400 text-sm">
                                <span className="material-icons text-3xl text-slate-200 block mb-1">
                                    pie_chart
                                </span>
                                No data available
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Activity Timeline + Quick Actions ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
                {/* Activity Timeline */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
                        <span className="material-icons text-primary text-lg">timeline</span>
                        Recent Activity
                    </h2>
                    {activityFeed.length > 0 ? (
                        <div className="space-y-0">
                            {activityFeed.map((item, idx) => (
                                <div
                                    key={item.id}
                                    className="flex items-start gap-3 px-2 py-1 rounded-lg hover:bg-slate-50/80 transition-colors"
                                >
                                    {/* Colored dot + vertical line */}
                                    <div className="flex flex-col items-center flex-shrink-0 pt-1">
                                        <div
                                            className={`w-3.5 h-3.5 rounded-full ${item.dotColor}`}
                                        />
                                        {idx < activityFeed.length - 1 && (
                                            <div className={`w-1 h-4 ${item.dotColor} opacity-40 mt-0.5 rounded-full`} />
                                        )}
                                    </div>
                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-800 font-semibold leading-snug">
                                            <span className="text-slate-500 font-medium">{item.time}</span>
                                            {" — "}
                                            {item.message}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400 text-sm">
                            <span className="material-icons text-3xl text-slate-200 block mb-1">
                                event_note
                            </span>
                            No recent activity
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
                        <span className="material-icons text-primary text-lg">bolt</span>
                        Quick Actions
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        {quickActions.map((action) => (
                            <Link
                                key={action.label}
                                href={action.href}
                                className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border border-slate-100 hover:border-primary/30 hover:shadow-md transition-all group ${action.cardBg}`}
                            >
                                <div
                                    className={`p-2.5 rounded-xl ${action.iconColor} group-hover:scale-110 transition-transform`}
                                >
                                    <span className="material-icons text-xl">{action.icon}</span>
                                </div>
                                <span className="text-sm font-bold text-slate-700 text-center">
                                    {action.label}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Recent Patients Table ── */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                {/* Table Header */}
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <span className="material-icons text-primary text-lg">recent_actors</span>
                        Recent Patients
                    </h2>
                    <div className="flex items-center gap-2">
                        {/* Status filter tabs */}
                        <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                            {(["all", "verified", "pending"] as StatusFilter[]).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setStatusFilter(f)}
                                    className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all capitalize ${statusFilter === f
                                        ? "bg-white text-primary shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <span className="material-icons absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                                search
                            </span>
                            <input
                                type="text"
                                placeholder="Search patients..."
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-44 transition-all"
                            />
                        </div>

                        <button className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 border border-transparent hover:border-slate-200 transition-all">
                            <span className="material-icons text-lg">download</span>
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                            <tr>
                                <th className="pl-8 pr-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                                    Patient
                                </th>
                                <th className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 hidden lg:table-cell">
                                    Age
                                </th>
                                <th className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 hidden lg:table-cell">
                                    Gender
                                </th>
                                <th className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 hidden md:table-cell">
                                    Contact Info
                                </th>
                                <th className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 hidden md:table-cell">
                                    Reg. Date
                                </th>
                                <th className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                                    Status
                                </th>
                                <th className="pl-4 pr-8 py-2.5 border-b border-slate-100 bg-slate-50/50 text-right">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-icons animate-spin text-primary">
                                                sync
                                            </span>
                                            <span className="text-xs font-medium">Loading patients...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredPatients.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-icons text-3xl text-slate-200">
                                                person_off
                                            </span>
                                            <span className="text-xs font-medium">
                                                No patients found.
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredPatients.slice(0, 6).map((patient, idx) => {
                                    const avatarColors = [
                                        "bg-blue-500",
                                        "bg-emerald-500",
                                        "bg-violet-500",
                                        "bg-rose-500",
                                        "bg-amber-500",
                                        "bg-teal-500",
                                    ];
                                    const avatarBg = avatarColors[idx % avatarColors.length];
                                    const isVerified = patient.emailVerified || patient.phoneVerified;

                                    return (
                                        <tr
                                            key={patient.patientCode || patient.id}
                                            className="hover:bg-slate-50/70 transition-colors group"
                                        >
                                            {/* Patient */}
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div
                                                        className={`w-8 h-8 rounded-full ${avatarBg} text-white flex items-center justify-center text-[10px] font-bold uppercase flex-shrink-0`}
                                                    >
                                                        {patient.fullName
                                                            ? patient.fullName
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("")
                                                                .slice(0, 2)
                                                            : "P"}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800 truncate">
                                                            {patient.fullName || "Unnamed Patient"}
                                                        </p>
                                                        <span className="text-[11px] text-slate-400 font-mono">
                                                            {patient.patientCode || patient.id}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Age */}
                                            <td className="px-4 py-2.5 hidden lg:table-cell">
                                                <span className="text-sm font-bold text-slate-700">
                                                    {calculateAge(patient.dob)}
                                                </span>
                                            </td>
                                            {/* Gender */}
                                            <td className="px-4 py-2.5 hidden lg:table-cell">
                                                <span className="text-sm font-semibold text-slate-600 capitalize">
                                                    {patient.gender
                                                        ? patient.gender.toLowerCase()
                                                        : "—"}
                                                </span>
                                            </td>
                                            {/* Contact Info */}
                                            <td className="px-4 py-2.5 hidden md:table-cell">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-700 truncate">
                                                        {patient.phone || patient.phoneNumber || "—"}
                                                    </p>
                                                    {patient.email && (
                                                        <p className="text-xs text-slate-400 truncate">
                                                            {patient.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            {/* Reg. Date */}
                                            <td className="px-4 py-2.5 text-sm font-semibold text-slate-500 hidden md:table-cell">
                                                {patient.createdAt
                                                    ? new Date(patient.createdAt).toLocaleDateString(
                                                        undefined,
                                                        {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        }
                                                    )
                                                    : "N/A"}
                                            </td>
                                            {/* Status */}
                                            <td className="px-4 py-2.5">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase rounded-full tracking-wider ${isVerified
                                                        ? "bg-green-50 text-green-600"
                                                        : "bg-orange-50 text-orange-600"
                                                        }`}
                                                >
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full ${isVerified ? "bg-green-500" : "bg-orange-400"
                                                            }`}
                                                    />
                                                    {isVerified ? "Verified" : "Pending"}
                                                </span>
                                            </td>
                                            {/* Action */}
                                            <td className="px-4 py-2.5 text-right">
                                                <Link
                                                    href={`/patients/${patient.patientCode || patient.id
                                                        }`}
                                                    className="inline-flex items-center gap-1 text-primary text-sm font-semibold hover:gap-1.5 transition-all px-2 py-1 rounded-md hover:bg-primary/5"
                                                >
                                                    View Profile
                                                    <span className="material-icons text-sm">
                                                        chevron_right
                                                    </span>
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer */}
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-400">
                    <span>
                        Showing {Math.min(filteredPatients.length, 6)} of{" "}
                        {filteredPatients.length} patients
                    </span>
                    <div className="flex gap-1.5">
                        <button
                            className="px-2.5 py-1 border border-slate-200 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all"
                            disabled
                        >
                            Previous
                        </button>
                        <button className="px-2.5 py-1 border border-slate-200 rounded-md hover:bg-white hover:shadow-sm transition-all">
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Footer ── */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-5 gap-2">
                <p>© 2025 Durdans Hospital. All Rights Reserved. Patient Management Module v2.5</p>
                <div className="flex gap-4">
                    <a className="hover:text-primary transition-colors" href="#">
                        Help Center
                    </a>
                    <a className="hover:text-primary transition-colors" href="#">
                        Privacy Policy
                    </a>
                    <a className="hover:text-primary transition-colors" href="#">
                        Report Issue
                    </a>
                </div>
            </div>
        </div>
    );
}
