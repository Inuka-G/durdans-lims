import type { AuditLog, Patient } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Time ranges                                                        */
/* ------------------------------------------------------------------ */

export type TimeRange = "today" | "7d" | "30d" | "365d";

/**
 * Only ranges the loaded data can answer honestly are offered. 30d / 1y need a
 * server-side aggregate (/patients/statistics registrationsByDay) — until that
 * exists they would be computed from the N most-recent rows and under-count.
 */
export const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "7d", label: "7 days" },
];

/** Plain-language description of each range for chart captions / SR text. */
export const RANGE_DESCRIPTIONS: Record<TimeRange, string> = {
    today: "today, by 3-hour slot",
    "7d": "over the last 7 days",
    "30d": "over the last 30 days",
    "365d": "over the last 12 months",
};

/* ------------------------------------------------------------------ */
/*  Patient helpers                                                    */
/* ------------------------------------------------------------------ */

export function calculateAge(dob: string | undefined | null): string {
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

export function parsePatientCreatedAt(patient: Patient): Date | null {
    const value = patient.createdAt;
    if (value == null) return null;
    const date = typeof value === "number" ? new Date(value) : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

export function patientInitials(name?: string): string {
    if (!name) return "P";
    return name
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

export function formatGender(gender?: string): string {
    if (!gender) return "—";
    const g = gender.toUpperCase();
    if (g.startsWith("M")) return "M";
    if (g.startsWith("F")) return "F";
    return "—";
}

export function formatPhone(phone?: string): string {
    if (!phone) return "—";
    const digits = phone.replace(/\D/g, "");
    // Sri Lankan mobile: 07X XXX XXXX
    if (digits.length === 10 && digits.startsWith("0")) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith("94")) {
        return `+94 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    return phone;
}

/** "Today 09:12", "Yesterday 14:02", "12 Aug 2026" */
export function formatRegistered(date: Date | null, now: Date = new Date()): string {
    if (!date) return "—";
    const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
    const dayStart = startOfLocalDay(now).getTime();
    const thatDay = startOfLocalDay(date).getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    if (thatDay === dayStart) return `Today ${time}`;
    if (thatDay === dayStart - dayMs) return `Yesterday ${time}`;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function startOfLocalDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/* ------------------------------------------------------------------ */
/*  Registration chart                                                  */
/* ------------------------------------------------------------------ */

function formatHourLabel(hour: number) {
    return `${String(hour).padStart(2, "0")}:00`;
}

function monthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export type ChartPoint = { name: string; patients: number };

export function buildRegistrationData(patients: Patient[], range: TimeRange, now: Date = new Date()): ChartPoint[] {
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
                patients: createdDates.filter(
                    (date) =>
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
            end.setDate(start.getDate() + 4);
            end.setHours(23, 59, 59, 999);
            return {
                name: `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${end.toLocaleDateString(undefined, { day: "numeric" })}`,
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

/* ------------------------------------------------------------------ */
/*  Trend string from the statistics endpoint → structured delta        */
/* ------------------------------------------------------------------ */

/** Backend emits "+12% vs yesterday", "-40% vs yesterday" or "no change vs yesterday". */
export function parseTrend(trend?: string | null): { value: number; label: string } | null {
    if (!trend) return null;
    const s = trend.trim();
    if (/^no change/i.test(s)) return { value: 0, label: s.replace(/^no change\s*/i, "") || "vs yesterday" };
    const m = s.match(/^([+-]?\d+(?:\.\d+)?)%\s*(.*)$/);
    if (!m) return null;
    return { value: Number(m[1]), label: m[2] || "vs yesterday" };
}

/* ------------------------------------------------------------------ */
/*  Audit log → activity feed                                           */
/* ------------------------------------------------------------------ */

export type ActivityKind = "create" | "update" | "verify" | "delete" | "notify" | "other";

export type ActivityFeedItem = {
    id: string;
    message: string;
    actor?: string;
    time: string;
    kind: ActivityKind;
    patientCode?: string;
};

const ACTION_KIND: Record<string, ActivityKind> = {
    REGISTER_PATIENT: "create",
    UPDATE_PROFILE: "update",
    UPDATE_PROFILE_PHOTO: "update",
    UPLOAD_DOCUMENT: "update",
    DELETE_DOCUMENT: "delete",
    VERIFY_EMAIL: "verify",
    VERIFY_PHONE: "verify",
    SEND_OTP: "notify",
    SEND_EMAIL_VERIFICATION: "notify",
};

/** Colour = meaning: new record, verified, removed. Everything else is neutral. */
export const ACTIVITY_DOT: Record<ActivityKind, string> = {
    create: "bg-primary",
    update: "bg-fg-faint",
    verify: "bg-status-verified",
    delete: "bg-status-danger",
    notify: "bg-fg-faint",
    other: "bg-edge-strong",
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

export function formatAuditTime(timestamp: string, now: Date = new Date()): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Recently";
    const diffMin = Math.round((now.getTime() - date.getTime()) / 60000);
    if (diffMin >= 0 && diffMin < 1) return "Just now";
    if (diffMin > 0 && diffMin < 60) return `${diffMin}m ago`;
    if (diffMin > 0 && diffMin < 24 * 60 && startOfLocalDay(date).getTime() === startOfLocalDay(now).getTime()) {
        return `${Math.floor(diffMin / 60)}h ago`;
    }
    return formatRegistered(date, now);
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
        .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
        .join(" ");
}

export function toActivityFeedItem(log: AuditLog, now: Date = new Date()): ActivityFeedItem {
    const action = log.action?.toUpperCase() || "ACTIVITY";
    const subject = getAuditSubject(log);

    const actionMessages: Record<string, string> = {
        REGISTER_PATIENT: `${subject} registered`,
        UPDATE_PROFILE: `${subject} profile updated`,
        UPDATE_PROFILE_PHOTO: `${subject} photo updated`,
        UPLOAD_DOCUMENT: `Document uploaded for ${subject}`,
        DELETE_DOCUMENT: `Document deleted for ${subject}`,
        VERIFY_EMAIL: `${subject} email verified`,
        VERIFY_PHONE: `${subject} phone verified`,
        SEND_OTP: `OTP sent to ${subject}`,
        SEND_EMAIL_VERIFICATION: `Verification email sent to ${subject}`,
    };

    return {
        id: log.id || `${action}-${log.timestamp}`,
        message: actionMessages[action] || `${formatActionLabel(action)} — ${subject}`,
        actor: log.performedBy || undefined,
        time: formatAuditTime(log.timestamp, now),
        kind: ACTION_KIND[action] || "other",
        patientCode: log.patientCode || undefined,
    };
}
