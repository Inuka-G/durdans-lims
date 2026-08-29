"use client";

import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { FileText, Calendar, Beaker, CheckCircle2, Clock } from "lucide-react";
import Button from "@/components/ui/Button";

// Dummy data for orders
const DUMMY_ORDERS = [
    {
        id: "ORD-20260830-001",
        date: "2026-08-30T10:00:00Z",
        tests: ["Complete Blood Count (CBC)", "Fasting Blood Sugar"],
        status: "Completed",
        doctor: "Dr. A. Smith",
        branch: "Main Lab",
    },
    {
        id: "ORD-20260825-042",
        date: "2026-08-25T14:30:00Z",
        tests: ["Lipid Profile", "Liver Function Test"],
        status: "Processing",
        doctor: "Dr. B. Jones",
        branch: "City Clinic",
    },
    {
        id: "ORD-20260810-015",
        date: "2026-08-10T09:15:00Z",
        tests: ["Thyroid Panel (T3, T4, TSH)"],
        status: "Completed",
        doctor: "Self Requested",
        branch: "Main Lab",
    }
];

export default function PatientOrdersPage() {
    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader 
                title="My Orders" 
                meta={<span>View your past and current test orders</span>}
            />

            <div className="space-y-6">
                {DUMMY_ORDERS.map((order) => (
                    <SectionCard key={order.id} title={`Order: ${order.id}`}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm text-fg-muted">
                                    <Calendar className="h-4 w-4" />
                                    <span>{new Date(order.date).toLocaleDateString()}</span>
                                    <span className="text-edge mx-1">|</span>
                                    <span>{order.doctor}</span>
                                    <span className="text-edge mx-1">|</span>
                                    <span>{order.branch}</span>
                                </div>
                                
                                <div>
                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                        <Beaker className="h-4 w-4 text-fg-muted" /> 
                                        Tests Included:
                                    </h4>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-fg-secondary ml-1">
                                        {order.tests.map((test, i) => (
                                            <li key={i}>{test}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            
                            <div className="flex flex-col sm:items-end gap-3">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                                    order.status === "Completed" 
                                    ? "bg-status-success-bg text-status-success-fg border border-status-success-edge" 
                                    : "bg-status-pending-bg text-status-pending-fg border border-status-pending-edge"
                                }`}>
                                    {order.status === "Completed" ? (
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                    ) : (
                                        <Clock className="h-3.5 w-3.5" />
                                    )}
                                    {order.status}
                                </span>
                                
                                {order.status === "Completed" && (
                                    <Button variant="outline" size="sm" icon={FileText} className="focus-visible:ring-offset-surface">
                                        View Report
                                    </Button>
                                )}
                            </div>
                        </div>
                    </SectionCard>
                ))}
            </div>
        </div>
    );
}
