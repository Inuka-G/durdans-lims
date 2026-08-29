"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { User, ClipboardList, Activity, FileText } from "lucide-react";
import Button from "@/components/ui/Button";
import Link from "next/link";

// Dummy profile and activity data
const DUMMY_PATIENT = {
    firstName: "John",
    lastName: "Doe",
    fullName: "John Doe",
    patientCode: "PT-12345678",
    phone: "0771234567",
    email: "john.doe@example.com"
};

const RECENT_ACTIVITY = [
    { id: 1, type: "report", text: "Complete Blood Count report is ready", date: "2 hours ago" },
    { id: 2, type: "order", text: "New test order placed", date: "Yesterday" },
    { id: 3, type: "profile", text: "Phone number updated", date: "3 days ago" }
];

export default function PatientPortalDashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate a small loading delay for realism
        const timer = setTimeout(() => setLoading(false), 600);
        return () => clearTimeout(timer);
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patientCode = (user as any)?.preferred_username || DUMMY_PATIENT.patientCode;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader 
                title="Welcome to your Portal" 
                meta={<span>View your tests, results, and profile details</span>}
            />

            {loading ? (
                <div className="flex h-32 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-primary"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <SectionCard title="Recent Activity">
                            <ul className="divide-y divide-edge">
                                {RECENT_ACTIVITY.map((activity) => (
                                    <li key={activity.id} className="flex items-start gap-4 py-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
                                            {activity.type === "report" && <FileText className="h-5 w-5" />}
                                            {activity.type === "order" && <ClipboardList className="h-5 w-5" />}
                                            {activity.type === "profile" && <Activity className="h-5 w-5" />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">{activity.text}</p>
                                            <p className="text-xs text-fg-muted mt-0.5">{activity.date}</p>
                                        </div>
                                        <Button variant="ghost" size="sm" className="hidden sm:inline-flex">View</Button>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-4 pt-4 border-t border-edge text-center">
                                <Link href="/patient-portal/orders" className="text-sm font-medium text-primary hover:underline">
                                    View all activity
                                </Link>
                            </div>
                        </SectionCard>
                    </div>

                    <div className="space-y-6">
                        <SectionCard title="Profile Snapshot">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs font-medium text-fg-muted">Name</p>
                                    <p className="mt-1 font-medium text-sm text-fg">{DUMMY_PATIENT.fullName}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-fg-muted">Patient ID</p>
                                    <p className="mt-1 font-mono text-sm text-fg-secondary">{patientCode}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-fg-muted">Phone</p>
                                    <p className="mt-1 text-sm text-fg">{DUMMY_PATIENT.phone}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-fg-muted">Email</p>
                                    <p className="mt-1 text-sm text-fg">{DUMMY_PATIENT.email}</p>
                                </div>
                                <Button href="/patient-portal/profile" variant="primary" icon={User} className="w-full justify-center focus-visible:ring-offset-surface">
                                    Manage Profile
                                </Button>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            )}
        </div>
    );
}
