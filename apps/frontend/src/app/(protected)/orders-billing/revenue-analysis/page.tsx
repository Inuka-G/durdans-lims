'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatCurrency, formatDateTime } from '@/constants/orders-billing';
import { getAuditLogs, getBillByOrderId, getBills, getOrders, logRevenueReportAccess, type AuditLog } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

function hasAnyRole(user: ReturnType<typeof useAuth>['user'], allowed: string[]): boolean {
    const roles = (user as { realm_access?: { roles?: string[] } }).realm_access?.roles ?? [];
    const normalized = new Set(roles.map((r) => String(r).toUpperCase()));
    return allowed.some((r) => normalized.has(String(r).toUpperCase()));
}

function formatRevenueAuditAction(action: string): string {
    switch (action) {
        case 'REVENUE_REPORT_VIEWED':
            return 'Revenue report viewed';
        case 'REVENUE_REPORT_EXPORTED':
            return 'Revenue report exported';
        default:
            return action;
    }
}

function activeUserDisplayName(user: ReturnType<typeof useAuth>['user']): string {
    if (!user) return '—';
    const u = user as Record<string, unknown>;
    return String(u.name ?? u.preferred_username ?? u.email ?? '—');
}

function activeUserRolesSummary(user: ReturnType<typeof useAuth>['user']): string {
    if (!user) return '—';
    const roles = (user as { realm_access?: { roles?: string[] } }).realm_access?.roles?.filter(
        (r) => r && !r.startsWith('default') && r !== 'offline_access'
    );
    if (!roles?.length) return '—';
    return roles.slice(0, 5).join(', ');
}

// ─── Data By Period ───────────────────────────────────────────────────────────

type Period = '7' | '30' | '90' | '365';
const PERIOD_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

type PaymentLike = { paymentMethod?: string; method?: string; amount?: number };

type BillLike = {
    id?: string;
    billId?: string;
    orderId?: string;
    patientId?: string;
    patientName?: string;
    billDate?: string;
    orderDate?: string;
    totalAmount?: number;
    paidAmount?: number;
    paymentStatus?: 'PAID' | 'PENDING' | 'NOT_PAID' | 'UNPAID' | string;
    orderStatus?: string;
    tests?: Array<{ category?: string; testName?: string; quantity?: number; totalPrice?: number; unitPrice?: number }>;
    payments?: PaymentLike[];
    createdAt?: string;
    updatedAt?: string;
};

type RevenueAnalyticsExport = {
    meta: {
        periodDays: number;
        windowStart: string;
        windowEnd: string;
        inPeriodBillsCount: number;
        paidBillsCount: number;
    };
    inPeriodBills: BillLike[];
    chartData: Array<{ label: string; revenue: number; collections: number }>;
    paymentMethods: Array<{ name: string; value: number; color: string }>;
    categoryRevenue: Array<{ category: string; revenue: number; orders: number }>;
    topTests: Array<{ name: string; orders: number; revenue: number; trend: string; up: boolean | null }>;
    stats: {
        totalRevenue: number;
        totalCollections: number;
        growth: string;
        collectionRate: number;
        transactions: number;
    };
};

function toNumber(value: unknown): number {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
}

function extractDateValue(bill: BillLike): string | undefined {
    const latestPayment = bill.payments?.[bill.payments.length - 1] as (PaymentLike & { paymentDate?: string; createdAt?: string; date?: string }) | undefined;
    return bill.billDate ?? bill.orderDate ?? bill.createdAt ?? latestPayment?.paymentDate ?? latestPayment?.createdAt ?? latestPayment?.date;
}

function normalizeBill(raw: any): BillLike {
    const totalAmount = toNumber(raw?.totalAmount ?? raw?.total ?? raw?.amount);
    const statusRaw = raw?.paymentStatus ?? raw?.status ?? raw?.billStatus;
    const paymentStatus = typeof statusRaw === 'string' ? statusRaw.toUpperCase() : undefined;
    const orderStatusRaw = raw?.orderStatus ?? raw?.order?.status ?? raw?.order_state;
    const orderStatus = typeof orderStatusRaw === 'string' ? orderStatusRaw.toUpperCase() : undefined;

    // System rule: only full paid or not paid.
    // If PAID, collections == total. If not, collections == 0.
    const paidAmount =
        paymentStatus === 'PAID'
            ? totalAmount
            : toNumber(raw?.paidAmount); // fallback if backend still sends it

    return {
        ...raw,
        totalAmount,
        paidAmount,
        paymentStatus,
        orderStatus,
        billDate: raw?.billDate ?? raw?.createdAt,
        tests: Array.isArray(raw?.tests) ? raw.tests : [],
        payments: Array.isArray(raw?.payments) ? raw.payments : [],
    };
}

function isPaidBill(bill: BillLike): boolean {
    const status = String(bill.paymentStatus ?? '').toUpperCase();
    if (status) return status === 'PAID';
    // Fallback if status missing: treat as paid only if amounts match
    const total = toNumber(bill.totalAmount);
    const paid = toNumber(bill.paidAmount);
    return total > 0 && paid >= total;
}

function isCancelledOrder(bill: BillLike): boolean {
    const status = String(bill.orderStatus ?? '').toUpperCase();
    return status === 'CANCELLED' || status === 'CANCELED';
}

function extractTestName(test: any): string {
    return String(
        test?.testName ??
        test?.name ??
        test?.test?.testName ??
        test?.test?.name ??
        test?.testCode ??
        'Unnamed Test'
    );
}

function extractCategory(test: any): string {
    return String(
        test?.category ??
        test?.testCategory ??
        test?.group ??
        test?.department ??
        test?.test?.category ??
        'Other'
    );
}

function extractQuantity(test: any): number {
    const q = toNumber(test?.quantity ?? test?.qty ?? 1);
    return q > 0 ? q : 1;
}

function extractLineRevenue(test: any): number {
    const qty = extractQuantity(test);
    const totalPrice = toNumber(test?.totalPrice ?? test?.lineTotal ?? test?.total);
    if (totalPrice > 0) return totalPrice;
    const unit = toNumber(test?.unitPrice ?? test?.price ?? test?.unit_cost);
    return unit * qty;
}

function formatTrend(current: number, previous: number): { trend: string; up: boolean | null } {
    if (previous <= 0) return { trend: 'N/A', up: null };
    const change = ((current - previous) / previous) * 100;
    return {
        trend: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
        up: change >= 0,
    };
}

function extractList(payload: any): any[] {
    const candidates = [
        payload,
        payload?.content,
        payload?.data,
        payload?.data?.content,
        payload?.result,
        payload?.result?.content,
    ];
    const list = candidates.find((item) => Array.isArray(item));
    return Array.isArray(list) ? list : [];
}

function appendJsonSheet(workbook: XLSX.WorkBook, sheetName: string, rows: Array<Record<string, unknown>>) {
    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

function exportSingleSheetWorkbook(filename: string, sheetName: string, rows: Array<Record<string, unknown>>) {
    const workbook = XLSX.utils.book_new();
    appendJsonSheet(workbook, sheetName, rows);
    XLSX.writeFile(workbook, filename);
}

function exportRevenueWorkbook(params: {
    filename: string;
    generatedAt: string;
    generatedBy: string;
    roles: string[];
    periodLabel: string;
    analytics: RevenueAnalyticsExport;
    auditLogs: AuditLog[];
}) {
    const { filename, generatedAt, generatedBy, roles, periodLabel, analytics, auditLogs } = params;
    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.aoa_to_sheet([
        ['Generated At', generatedAt],
        ['Generated By', generatedBy],
        ['Roles', roles.join(', ')],
        ['Period', periodLabel],
        ['Window Start', analytics.meta.windowStart],
        ['Window End', analytics.meta.windowEnd],
        ['Total Revenue', analytics.stats.totalRevenue],
        ['Total Collections', analytics.stats.totalCollections],
        ['Growth', analytics.stats.growth],
        ['Collection Rate (%)', analytics.stats.collectionRate],
        ['Transactions', analytics.stats.transactions],
        ['Bills In Period', analytics.meta.inPeriodBillsCount],
        ['Paid Bills', analytics.meta.paidBillsCount],
    ]);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    appendJsonSheet(workbook, 'Revenue Trend', analytics.chartData.map((row) => ({
        Period: row.label,
        Revenue: row.revenue,
        Collections: row.collections,
    })));

    appendJsonSheet(workbook, 'Payment Methods', analytics.paymentMethods.map((row) => ({
        Method: row.name,
        Percentage: row.value,
    })));

    appendJsonSheet(workbook, 'Revenue By Category', analytics.categoryRevenue.map((row) => ({
        Category: row.category,
        Orders: row.orders,
        Revenue: row.revenue,
    })));

    appendJsonSheet(workbook, 'Top Tests', analytics.topTests.map((row) => ({
        Test: row.name,
        Orders: row.orders,
        Revenue: row.revenue,
        Trend: row.trend,
    })));

    appendJsonSheet(workbook, 'Bills', analytics.inPeriodBills.map((bill) => ({
        'Bill ID': bill.billId ?? bill.id ?? '',
        'Order ID': bill.orderId ?? '',
        'Patient ID': bill.patientId ?? '',
        Patient: bill.patientName ?? '',
        Date: extractDateValue(bill) ?? '',
        Status: bill.paymentStatus ?? '',
        'Order Status': bill.orderStatus ?? '',
        'Total Amount': toNumber(bill.totalAmount),
        'Paid Amount': toNumber(bill.paidAmount),
    })));

    appendJsonSheet(workbook, 'Audit Log', auditLogs.map((entry) => ({
        Action: formatRevenueAuditAction(entry.action),
        User: entry.performedBy,
        Branch: entry.branchCode,
        Details: entry.details ?? '',
        Timestamp: entry.timestamp ?? '',
        'IP Address': entry.ipAddress ?? '',
    })));

    XLSX.writeFile(workbook, filename);
}

async function fetchRevenueBills(): Promise<BillLike[]> {
    let lastError: any = null;

    try {
        const direct = await getBills(0, 500);
        const directList = extractList(direct);
        const normalizedDirect = directList.map(normalizeBill);
        if (normalizedDirect.length > 0) return normalizedDirect;
    } catch (err: any) {
        lastError = err;
    }

    let ordersList: any[] = [];
    try {
        const orders = await getOrders(0, 200);
        ordersList = extractList(orders);
    } catch (err: any) {
        lastError = err;
    }
    if (ordersList.length === 0) {
        if (lastError?.response?.status === 404) return [];
        if (lastError) throw lastError;
        return [];
    }

    const billsFromOrders = await Promise.all(
        ordersList.map(async (order: any) => {
            try {
                const orderId = order?.id ?? order?.orderId;
                if (!orderId) return null;
                const bill = await getBillByOrderId(orderId);
                return bill ? normalizeBill(bill) : null;
            } catch {
                return null;
            }
        })
    );
    const normalized = billsFromOrders.filter((b): b is BillLike => Boolean(b));
    if (normalized.length > 0) return normalized;

    if (lastError?.response?.status === 404) return [];
    if (lastError) throw lastError;
    return [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-3 text-xs">
                <p className="font-bold text-slate-700 mb-1">{label}</p>
                {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
                    <p key={i} style={{ color: entry.color }} className="font-semibold">
                        {entry.name}: {formatCurrency(entry.value)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
}

export default function RevenueAnalysisPage() {
    const { user } = useAuth();
    const [period, setPeriod] = useState<Period>('30');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showAuditLog, setShowAuditLog] = useState(false);
    const [bills, setBills] = useState<BillLike[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState<string | null>(null);

    const periodLabels: Record<Period, string> = { '7': 'Last 7 Days', '30': 'Last 30 Days', '90': 'Last 90 Days', '365': 'Last Year' };

    // RBAC (real): derived from Keycloak realm roles.
    // Adjust allowed roles here to match your policy.
    const hasPermission = (perm: string) => {
        switch (perm) {
            case 'view_revenue':
                return hasAnyRole(user, ['FRONT_DESK', 'BRANCH_ADMIN', 'SUPER_ADMIN']);
            case 'export_reports':
                return hasAnyRole(user, ['BRANCH_ADMIN', 'SUPER_ADMIN']);
            case 'view_audit_log':
                return hasAnyRole(user, ['BRANCH_ADMIN', 'SUPER_ADMIN']);
            default:
                return false;
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            setError(null);
            const list = await fetchRevenueBills();
            setBills(list);
        } catch (err: any) {
            setError(err?.message || 'Failed to refresh revenue data.');
        } finally {
            setIsRefreshing(false);
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            await logRevenueReportAccess({ event: 'EXPORT', detail: periodLabels[period] });
        } catch {
            // non-blocking for export UX
        }

        const safePeriod = periodLabels[period].replaceAll(' ', '_').replaceAll('/', '_');
        const generatedAt = new Date().toISOString();
        const filename = `revenue_analysis_${safePeriod}_${generatedAt.slice(0, 10)}.xlsx`;
        exportRevenueWorkbook({
            filename,
            generatedAt,
            generatedBy: activeUserDisplayName(user),
            roles: (user as { realm_access?: { roles?: string[] } }).realm_access?.roles ?? [],
            periodLabel: periodLabels[period],
            analytics,
            auditLogs,
        });
    };

    const getExportFilename = (reportName: string) => {
        const safePeriod = periodLabels[period].replaceAll(' ', '_').replaceAll('/', '_');
        return `${reportName}_${safePeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    };

    const handleExportPaymentMethods = () => {
        exportSingleSheetWorkbook(
            getExportFilename('payment_methods'),
            'Payment Methods',
            analytics.paymentMethods.map((row) => ({
                Method: row.name,
                Percentage: row.value,
            }))
        );
    };

    const handleExportCategoryRevenue = () => {
        exportSingleSheetWorkbook(
            getExportFilename('revenue_by_category'),
            'Revenue By Category',
            analytics.categoryRevenue.map((row) => ({
                Category: row.category,
                Orders: row.orders,
                Revenue: row.revenue,
            }))
        );
    };

    const handleExportTopTests = () => {
        exportSingleSheetWorkbook(
            getExportFilename('top_performing_tests'),
            'Top Performing Tests',
            analytics.topTests.map((row) => ({
                Test: row.name,
                Orders: row.orders,
                Revenue: row.revenue,
                Trend: row.trend,
            }))
        );
    };

    useEffect(() => {
        logRevenueReportAccess({ event: 'VIEW', detail: periodLabels['30'] }).catch(() => { });
    }, []);

    useEffect(() => {
        if (!showAuditLog || !hasPermission('view_audit_log')) return;
        const loadAudit = async () => {
            try {
                setAuditLoading(true);
                setAuditError(null);
                const page = await getAuditLogs({
                    entityType: 'REVENUE_REPORT',
                    page: 0,
                    size: 50,
                });
                setAuditLogs(page.content ?? []);
            } catch (err: any) {
                setAuditError(err?.message || 'Failed to load audit log.');
                setAuditLogs([]);
            } finally {
                setAuditLoading(false);
            }
        };
        void loadAudit();
    }, [showAuditLog]);

    useEffect(() => {
        const fetchRevenueData = async () => {
            try {
                setLoading(true);
                setError(null);
                const list = await fetchRevenueBills();
                setBills(list);
            } catch (err: any) {
                setError(err?.message || 'Failed to load revenue analysis.');
            } finally {
                setLoading(false);
            }
        };
        fetchRevenueData();
    }, []);

    const analytics = useMemo(() => {
        const latestBillDate = bills.reduce<Date | null>((latest, bill) => {
            const dateValue = extractDateValue(bill);
            if (!dateValue) return latest;
            const dt = new Date(dateValue);
            if (Number.isNaN(dt.getTime())) return latest;
            if (!latest || dt > latest) return dt;
            return latest;
        }, null);

        // If seeded/mock data is historical, anchor period windows to latest bill date.
        const now = latestBillDate ?? new Date();
        const periodDays = Number(period);
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - periodDays);

        const inPeriodBills = bills.filter((bill) => {
            const dateValue = extractDateValue(bill);
            if (!dateValue) return false;
            const dt = new Date(dateValue);
            return !Number.isNaN(dt.getTime()) && dt >= startDate && dt <= now;
        });

        const paidBills = inPeriodBills.filter(isPaidBill);

        const totalRevenue = inPeriodBills.reduce((sum, b) => sum + toNumber(b.totalAmount), 0);
        const totalCollections = inPeriodBills.reduce((sum, b) => sum + toNumber(b.paidAmount), 0);
        const transactions = paidBills.length; // 1 bill == 1 payment in full-paid-only flow
        const collectionRate = totalRevenue > 0 ? (totalCollections / totalRevenue) * 100 : 0;

        const prevStart = new Date(startDate);
        prevStart.setDate(startDate.getDate() - periodDays);
        const previousPeriodBills = bills.filter((bill) => {
            const dateValue = extractDateValue(bill);
            if (!dateValue) return false;
            const dt = new Date(dateValue);
            return !Number.isNaN(dt.getTime()) && dt >= prevStart && dt < startDate;
        });
        const previousRevenue = previousPeriodBills.reduce((sum, b) => sum + toNumber(b.totalAmount), 0);
        const growthRaw = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
        const growth = `${growthRaw >= 0 ? '+' : ''}${growthRaw.toFixed(1)}%`;

        const buckets = period === '7' ? 7 : period === '30' ? 4 : period === '90' ? 3 : 6;
        const labels = period === '7'
            ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            : period === '30'
                ? ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4']
                : period === '90'
                    ? ['M1', 'M2', 'M3']
                    : ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
        const chartData = Array.from({ length: buckets }, (_, idx) => ({
            label: labels[idx] ?? `${idx + 1}`,
            revenue: 0,
            collections: 0,
        }));

        for (const bill of inPeriodBills) {
            const dateValue = extractDateValue(bill);
            if (!dateValue) continue;
            const dt = new Date(dateValue);
            if (Number.isNaN(dt.getTime())) continue;
            const diffDays = Math.max(0, Math.floor((now.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24)));
            const bucketSize = Math.max(1, Math.ceil(periodDays / buckets));
            const bucketIndex = Math.min(buckets - 1, Math.floor((periodDays - 1 - diffDays) / bucketSize));
            chartData[bucketIndex].revenue += toNumber(bill.totalAmount);
            chartData[bucketIndex].collections += toNumber(bill.paidAmount);
        }

        const paymentMethodMap = new Map<string, number>();
        // Payment methods only apply to paid bills in the "paid / not paid" model
        for (const bill of paidBills) {
            for (const payment of bill.payments ?? []) {
                const keyRaw = payment.paymentMethod ?? payment.method ?? 'UNKNOWN';
                const key = String(keyRaw).replaceAll('_', ' ').toLowerCase()
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                paymentMethodMap.set(key, (paymentMethodMap.get(key) ?? 0) + Number(payment.amount ?? 0));
            }
        }
        const paymentMethodsRaw = Array.from(paymentMethodMap.entries()).sort((a, b) => b[1] - a[1]);
        const paymentMethodsTotal = paymentMethodsRaw.reduce((s, [, v]) => s + v, 0);
        const paymentMethods = paymentMethodsRaw.slice(0, 5).map(([name, value], idx) => ({
            name,
            value: paymentMethodsTotal > 0 ? Number(((value / paymentMethodsTotal) * 100).toFixed(1)) : 0,
            color: PERIOD_COLORS[idx % PERIOD_COLORS.length],
        }));

        const categoryMap = new Map<string, { revenue: number; orders: number }>();
        const testMap = new Map<string, { revenue: number; orders: number }>();
        const previousTestMap = new Map<string, { revenue: number; orders: number }>();

        const eligibleBills = inPeriodBills.filter((b) => !isCancelledOrder(b));
        for (const bill of eligibleBills) {
            for (const test of bill.tests ?? []) {
                const category = extractCategory(test);
                const testName = extractTestName(test);
                const lineRevenue = extractLineRevenue(test);

                // "Orders" should count the number of (non-cancelled) orders containing the test,
                // not the quantity of the line item.
                const cat = categoryMap.get(category) ?? { revenue: 0, orders: 0 };
                cat.revenue += lineRevenue;
                cat.orders += 1;
                categoryMap.set(category, cat);

                const t = testMap.get(testName) ?? { revenue: 0, orders: 0 };
                t.revenue += lineRevenue;
                t.orders += 1;
                testMap.set(testName, t);
            }
        }

        const previousEligibleBills = previousPeriodBills.filter((b) => !isCancelledOrder(b));
        for (const bill of previousEligibleBills) {
            for (const test of bill.tests ?? []) {
                const testName = extractTestName(test);
                const lineRevenue = extractLineRevenue(test);
                const t = previousTestMap.get(testName) ?? { revenue: 0, orders: 0 };
                t.revenue += lineRevenue;
                t.orders += 1;
                previousTestMap.set(testName, t);
            }
        }

        const categoryRevenue = Array.from(categoryMap.entries())
            .map(([category, v]) => ({ category, revenue: v.revenue, orders: v.orders }))
            .sort((a, b) => b.revenue - a.revenue);

        const topTests = Array.from(testMap.entries())
            .map(([name, v]) => {
                const previous = previousTestMap.get(name);
                return {
                    name,
                    orders: v.orders,
                    revenue: v.revenue,
                    ...formatTrend(v.revenue, previous?.revenue ?? 0),
                };
            })
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        return {
            meta: {
                periodDays,
                windowStart: startDate.toISOString(),
                windowEnd: now.toISOString(),
                inPeriodBillsCount: inPeriodBills.length,
                paidBillsCount: paidBills.length,
            },
            inPeriodBills,
            chartData,
            paymentMethods,
            categoryRevenue,
            topTests,
            stats: {
                totalRevenue,
                totalCollections,
                growth,
                collectionRate: Number(collectionRate.toFixed(1)),
                transactions,
            },
        };
    }, [bills, period]);

    // ── RBAC Guard ────────────────────────────────────────────────────────────
    if (!hasPermission('view_revenue')) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
                    <span className="material-icons text-3xl text-red-600">lock</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
                <p className="text-sm text-slate-500 text-center max-w-xs">
                    You do not have permission to view revenue reports.
                    Please contact your system administrator.
                </p>
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
                    <span className="material-icons text-base">security</span>
                    Required permission: <span className="font-mono font-bold">view_revenue</span>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-slate-300 animate-spin">progress_activity</span>
                <p className="text-sm text-slate-400 font-medium">Loading revenue analysis...</p>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Revenue Analysis</h1>
                    <p className="text-sm text-slate-500 mt-1">Financial performance and revenue breakdown</p>
                    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Period buttons */}
                    <div className="flex items-center gap-1">
                        {(['7', '30', '90', '365'] as Period[]).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${period === p
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {periodLabels[p]}
                            </button>
                        ))}
                    </div>
                    {/* Refresh */}
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <span className={`material-icons text-base ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                    {/* Export */}
                    <button
                        onClick={handleExport}
                        title="Export revenue report"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors text-slate-600 bg-white border-slate-200 hover:bg-slate-50"
                    >
                        <span className="material-icons text-base">download</span>
                        Export
                    </button>
                </div>
            </div>

            {/* KPI Cards — full-paid bills only; no outstanding */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <span className="material-icons text-blue-600">trending_up</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{analytics.stats.growth}</span>
                    </div>
                    <p className="text-xl font-bold text-slate-800">{formatCurrency(analytics.stats.totalRevenue)}</p>
                    <p className="text-xs text-slate-500">Total Revenue</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
                        <span className="material-icons text-emerald-600">account_balance_wallet</span>
                    </div>
                    <p className="text-xl font-bold text-slate-800">{formatCurrency(analytics.stats.totalCollections)}</p>
                    <p className="text-xs text-slate-500">Collections</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                            <span className="material-icons text-violet-600">receipt</span>
                        </div>
                        <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-lg">{analytics.stats.collectionRate}% rate</span>
                    </div>
                    <p className="text-xl font-bold text-slate-800">{analytics.stats.transactions.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Transactions</p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Revenue Trend Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Revenue Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={analytics.chartData}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorCollections" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#colorRevenue)" strokeWidth={2} />
                            <Area type="monotone" dataKey="collections" name="Collections" stroke="#10b981" fill="url(#colorCollections)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Payment Methods Pie */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Payment Methods</h3>
                        <button
                            onClick={handleExportPaymentMethods}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <span className="material-icons text-sm">download</span>
                            Export
                        </button>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie data={analytics.paymentMethods} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>
                                {analytics.paymentMethods.map((entry, i) => (
                                    <Cell key={i} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 space-y-1.5">
                        {analytics.paymentMethods.map((m) => (
                            <div key={m.name} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                                    <span className="text-slate-600">{m.name}</span>
                                </div>
                                <span className="font-bold text-slate-700">{m.value}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Category Revenue Bar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Revenue by Category</h3>
                        <button
                            onClick={handleExportCategoryRevenue}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <span className="material-icons text-sm">download</span>
                            Export
                        </button>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={analytics.categoryRevenue}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="category" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Top Tests Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Top Performing Tests</h3>
                        <button
                            onClick={handleExportTopTests}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <span className="material-icons text-sm">download</span>
                            Export
                        </button>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <th className="text-left pb-3">Test</th>
                                <th className="text-right pb-3">Orders</th>
                                <th className="text-right pb-3">Revenue</th>
                                <th className="text-right pb-3">Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analytics.topTests.map((test) => (
                                <tr key={test.name} className="border-t border-slate-50">
                                    <td className="py-2.5 font-medium text-slate-700">{test.name}</td>
                                    <td className="py-2.5 text-right text-slate-500">{test.orders}</td>
                                    <td className="py-2.5 text-right font-semibold text-slate-700">{formatCurrency(test.revenue)}</td>
                                    <td className="py-2.5 text-right">
                                        <span className={`inline-flex items-center text-xs font-bold ${test.up === null ? 'text-slate-400' : test.up ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {test.up !== null && (
                                                <span className="material-icons text-sm">{test.up ? 'arrow_upward' : 'arrow_downward'}</span>
                                            )}
                                            {test.trend}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Security Audit Log */}
            {hasPermission('view_audit_log') && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <button
                        onClick={() => setShowAuditLog(v => !v)}
                        className="w-full flex items-center justify-between text-left"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            <div className="flex items-center gap-2">
                                <span className="material-icons text-amber-600">security</span>
                                <span className="font-bold text-amber-800">Security Audit Log</span>
                                <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-lg">
                                    Revenue report access history
                                </span>
                            </div>
                            <span className="text-xs text-amber-800 sm:ml-2">
                                Signed in as <span className="font-semibold">{activeUserDisplayName(user)}</span>
                                {activeUserRolesSummary(user) !== '—' && (
                                    <span className="text-amber-700"> · {activeUserRolesSummary(user)}</span>
                                )}
                            </span>
                        </div>
                        <span className="material-icons text-amber-600 shrink-0">
                            {showAuditLog ? 'expand_less' : 'expand_more'}
                        </span>
                    </button>

                    {showAuditLog && (
                        <div className="mt-4 overflow-x-auto">
                            {auditError && (
                                <p className="text-xs text-red-600 mb-2">{auditError}</p>
                            )}
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                                        <th className="text-left pb-3">Action</th>
                                        <th className="text-left pb-3">User</th>
                                        <th className="text-left pb-3">Branch</th>
                                        <th className="text-left pb-3">Details</th>
                                        <th className="text-left pb-3">Timestamp</th>
                                        <th className="text-left pb-3">IP Address</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLoading ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-amber-700 text-xs">
                                                Loading audit log…
                                            </td>
                                        </tr>
                                    ) : auditLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-amber-600 text-xs">
                                                No revenue report access events recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        auditLogs.map((entry) => (
                                            <tr key={entry.id} className="border-t border-amber-100">
                                                <td className="py-2.5 font-medium text-amber-900">
                                                    {formatRevenueAuditAction(entry.action)}
                                                </td>
                                                <td className="py-2.5 text-amber-800">{entry.performedBy}</td>
                                                <td className="py-2.5">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-700">
                                                        {entry.branchCode || '—'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 text-amber-800 max-w-[200px] truncate" title={entry.details}>
                                                    {entry.details || '—'}
                                                </td>
                                                <td className="py-2.5 font-mono text-xs text-amber-700">
                                                    {entry.timestamp ? formatDateTime(entry.timestamp) : '—'}
                                                </td>
                                                <td className="py-2.5 font-mono text-xs text-amber-600">
                                                    {entry.ipAddress || '—'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
