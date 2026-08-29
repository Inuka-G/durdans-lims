"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getPatientOrders } from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import { FileText, Calendar, Beaker, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";

export default function PatientOrdersPage() {
    const { user } = useAuth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patientCode = (user as any)?.preferred_username;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!patientCode) {
            setError("Could not identify patient from session.");
            setLoading(false);
            return;
        }

        getPatientOrders(patientCode)
            .then((data) => {
                setOrders(data?.content || []);
            })
            .catch((err) => {
                console.error("Failed to fetch patient orders", err);
                setError("Failed to load your orders. Please try again later.");
            })
            .finally(() => setLoading(false));
    }, [patientCode]);

    if (loading) {
        return (
            <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-primary"></div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader 
                title="My Orders" 
                meta={<span>View your past and current test orders</span>}
            />

            {error && (
                <div className="mb-6 rounded-lg border border-status-danger-edge bg-status-danger-bg p-4 text-status-danger-fg">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">{error}</span>
                    </div>
                </div>
            )}

            {!error && orders.length === 0 && (
                <SectionCard>
                    <div className="py-12 text-center text-fg-muted">
                        <p>You do not have any test orders.</p>
                    </div>
                </SectionCard>
            )}

            <div className="space-y-6">
                {orders.map((order) => {
                    // Approximate status determination based on the response format
                    // LIMS orders often have a 'status' field or use 'paymentStatus' / 'tests' statuses
                    const isCompleted = order.status === "COMPLETED";
                    const orderStatus = order.status || "PROCESSING";
                    const doctor = order.clinicalDetails?.requestingPhysician || "Self Requested";
                    const branch = order.branchCode || "Main Lab";
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const testNames = (order.tests || []).map((t: any) => t.catalogName || t.testCode || "Unknown Test");

                    return (
                        <SectionCard key={order.orderId} title={`Order: ${order.orderId}`}>
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm text-fg-muted">
                                        <Calendar className="h-4 w-4" />
                                        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                                        <span className="text-edge mx-1">|</span>
                                        <span>{doctor}</span>
                                        <span className="text-edge mx-1">|</span>
                                        <span>{branch}</span>
                                    </div>
                                    
                                    <div>
                                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                            <Beaker className="h-4 w-4 text-fg-muted" /> 
                                            Tests Included:
                                        </h4>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-fg-secondary ml-1">
                                            {testNames.map((testName: string, i: number) => (
                                                <li key={i}>{testName}</li>
                                            ))}
                                            {testNames.length === 0 && (
                                                <li className="text-fg-faint list-none">No tests listed</li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col sm:items-end gap-3">
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium uppercase ${
                                        isCompleted 
                                        ? "bg-status-success-bg text-status-success-fg border border-status-success-edge" 
                                        : "bg-status-pending-bg text-status-pending-fg border border-status-pending-edge"
                                    }`}>
                                        {isCompleted ? (
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                        ) : (
                                            <Clock className="h-3.5 w-3.5" />
                                        )}
                                        {orderStatus}
                                    </span>
                                </div>
                            </div>
                        </SectionCard>
                    );
                })}
            </div>
        </div>
    );
}
