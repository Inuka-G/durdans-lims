"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPatientOrders } from "@/lib/api";
import { getOrderStatusColor, PAYMENT_STATUS_COLORS } from "@/constants/orders-billing";
import { usePatient } from "../../PatientProvider";

type PatientOrderRow = {
    id: string;
    orderId: string;
    orderDate?: string | null;
    status?: string | null;
    paymentStatus?: string | null;
    tests?: Array<{
        testCode?: string | null;
        testName?: string | null;
    }>;
};

const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-LK", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatLabel = (value?: string | null) => {
    return value ? value.replace(/_/g, " ") : "-";
};

export default function PatientOrdersTab() {
    const { patient } = usePatient();
    const [orders, setOrders] = useState<PatientOrderRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        const patientCode = patient?.patientCode || patient?.id;

        if (!patientCode) {
            setLoading(false);
            return;
        }

        const loadOrders = async () => {
            try {
                setLoading(true);
                setError("");
                const response = await getPatientOrders(patientCode, 0, 50);
                if (!active) return;
                setOrders(response?.content ?? []);
            } catch (loadError) {
                console.error("Failed to load patient orders", loadError);
                if (active) setError("Could not load this patient's orders.");
            } finally {
                if (active) setLoading(false);
            }
        };

        void loadOrders();

        return () => {
            active = false;
        };
    }, [patient?.id, patient?.patientCode]);

    if (!patient) return null;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="material-icons text-primary text-xl">list_alt</span>
                    Test Orders History
                </h3>
                <Link
                    href="/orders-billing/create-order"
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition-colors"
                >
                    <span className="material-icons text-sm">add</span>
                    Create New Order
                </Link>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                            <th className="px-6 py-4 border-b border-slate-100">Order ID</th>
                            <th className="px-6 py-4 border-b border-slate-100">Order Date</th>
                            <th className="px-6 py-4 border-b border-slate-100">Tests / Panels Summary</th>
                            <th className="px-6 py-4 border-b border-slate-100 text-center">Order Status</th>
                            <th className="px-6 py-4 border-b border-slate-100 text-center">Payment Status</th>
                            <th className="px-6 py-4 border-b border-slate-100 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                                    Loading patient orders...
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-sm text-red-500">
                                    {error}
                                </td>
                            </tr>
                        ) : orders.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                                    No test orders found for this patient.
                                </td>
                            </tr>
                        ) : (
                            orders.map((order) => (
                                <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-semibold text-primary text-sm whitespace-nowrap">
                                        {order.orderId}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                        {formatDateTime(order.orderDate)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {(order.tests ?? []).length === 0 ? (
                                                <span className="text-xs text-slate-400">No tests listed</span>
                                            ) : (
                                                (order.tests ?? []).map((test, index) => (
                                                    <span
                                                        key={`${order.id}-${test.testCode ?? index}`}
                                                        className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] border border-slate-200"
                                                    >
                                                        {test.testName || test.testCode || "Unknown test"}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded tracking-wider ${getOrderStatusColor(order.status ?? "")}`}>
                                            {formatLabel(order.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded tracking-wider ${PAYMENT_STATUS_COLORS[order.paymentStatus ?? "PENDING"] ?? PAYMENT_STATUS_COLORS.PENDING}`}>
                                            {formatLabel(order.paymentStatus ?? "PENDING")}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            className="text-primary hover:text-primary/80 text-sm font-bold flex items-center justify-end gap-1"
                                            href={`/orders-billing/orders/${order.id}`}
                                        >
                                            View Order <span className="material-icons text-sm">open_in_new</span>
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500">Showing {orders.length} order{orders.length === 1 ? "" : "s"}</p>
            </div>
        </div>
    );
}
