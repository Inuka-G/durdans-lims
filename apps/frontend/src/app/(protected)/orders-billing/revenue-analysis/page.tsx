'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    ChevronDown,
    ChevronUp,
    CreditCard,
    Download,
    FlaskConical,
    History,
    Lock,
    Receipt,
    RefreshCw,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/constants/orders-billing';
import { getAuditLogs, getBillByOrderId, getBills, getOrders, logRevenueReportAccess, type AuditLog } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import KpiTile from '@/components/ui/KpiTile';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedControl, { type SegmentOption } from '@/components/ui/SegmentedControl';
import StatusChip from '@/components/ui/StatusChip';
import { formatAuditTime } from '@/components/patient-dashboard/dashboard-data';

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
/** Chart series colours (literal by design — see DESIGN.md). Index 0 is the brand colour. */
const PERIOD_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
const SERIES_REVENUE = 'var(--color-primary)';
const SERIES_COLLECTIONS = '#10b981';

/** UI labels (sentence case). `periodLabels` inside the page keeps the legacy text used for export filenames / audit detail. */
const PERIOD_OPTIONS: SegmentOption<Period>[] = [
    { value: '7', label: '7 days' },
    { value: '30', label: '30 days' },
    { value: '90', label: '90 days' },
    { value: '365', label: '1 year' },
];
const PERIOD_DISPLAY: Record<Period, string> = {
    '7': 'Last 7 days',
    '30': 'Last 30 days',
    '90': 'Last 90 days',
    '365': 'Last year',
};

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

// ─── Chart chrome ─────────────────────────────────────────────────────────────

const AXIS_TICK = { fontSize: 11, fill: 'var(--fg-muted)' };
const TOOLTIP_STYLE = {
    borderRadius: 6,
    border: '1px solid var(--edge)',
    background: 'var(--surface)',
    color: 'var(--fg)',
    boxShadow: '0 2px 8px rgb(15 23 42 / 0.12)',
    fontSize: 12,
    padding: '6px 10px',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div style={TOOLTIP_STYLE}>
                <p className="mb-1 text-fg-muted">{label}</p>
                {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
                    <p key={i} className="flex items-center gap-1.5 font-medium tabular-nums text-fg">
                        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                        {entry.name}: {formatCurrency(entry.value)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
}

function ChartSkeleton({ className }: { className?: string }) {
    return (
        <div aria-hidden="true" className={cn('flex h-full items-end gap-2 px-4 pb-6', className)}>
            {[40, 65, 30, 80, 55, 45, 70].map((h, i) => (
                <span key={i} className="flex-1 rounded-t bg-skeleton" style={{ height: `${h}%` }} />
            ))}
        </div>
    );
}

function TrendCell({ trend, up }: { trend: string; up: boolean | null }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
                up === null ? 'text-fg-muted' : up ? 'text-status-verified-fg' : 'text-status-danger-fg'
            )}
        >
            {up !== null &&
                (up ? (
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ))}
            {up !== null && <span className="sr-only">{up ? 'Up' : 'Down'} </span>}
            {up === null ? '—' : trend}
        </span>
    );
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

    const growthValue = Number.parseFloat(analytics.stats.growth);
    const growthDelta = Number.isFinite(growthValue)
        ? { value: growthValue, unit: '%' as const, label: 'vs previous period' }
        : undefined;
    const periodDisplay = PERIOD_DISPLAY[period];
    const hasRevenueData = analytics.meta.inPeriodBillsCount > 0;
    const signedInName = activeUserDisplayName(user);
    const signedInRoles = activeUserRolesSummary(user);

    // ── RBAC Guard ────────────────────────────────────────────────────────────
    if (!hasPermission('view_revenue')) {
        return (
            <div className="mx-auto max-w-[1400px]">
                <PageHeader title="Revenue analysis" meta="Financial performance and revenue breakdown" />
                <SectionCard title="Access restricted">
                    <div role="alert">
                        <EmptyState
                            icon={Lock}
                            title="You don't have permission to view revenue reports"
                            description="Contact your system administrator if you need access."
                            action={
                                <StatusChip tone="pending">
                                    Required permission: <span className="font-mono">view_revenue</span>
                                </StatusChip>
                            }
                        />
                    </div>
                </SectionCard>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-[1400px]">
                <PageHeader title="Revenue analysis" meta="Financial performance and revenue breakdown" />
                <p role="status" aria-live="polite" className="sr-only">
                    Loading revenue analysis
                </p>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <KpiTile label="Total revenue" value={null} icon={TrendingUp} loading />
                    <KpiTile label="Collections" value={null} icon={Wallet} loading />
                    <KpiTile label="Transactions" value={null} icon={Receipt} loading />
                </div>
                <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <SectionCard title="Revenue trend" className="lg:col-span-2" bodyClassName="px-2 pb-2 pt-3">
                        <div className="h-72">
                            <ChartSkeleton />
                        </div>
                    </SectionCard>
                    <SectionCard title="Payment methods" bodyClassName="px-2 pb-2 pt-3">
                        <div className="h-72">
                            <ChartSkeleton />
                        </div>
                    </SectionCard>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <SectionCard title="Revenue by category" bodyClassName="px-2 pb-2 pt-3">
                        <div className="h-60">
                            <ChartSkeleton />
                        </div>
                    </SectionCard>
                    <SectionCard title="Top performing tests" flush>
                        <ul aria-hidden="true" className="divide-y divide-edge">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                    <span className="h-3 w-40 rounded bg-skeleton" />
                                    <span className="ml-auto h-3 w-10 rounded bg-skeleton" />
                                    <span className="h-3 w-24 rounded bg-skeleton" />
                                    <span className="h-3 w-12 rounded bg-skeleton" />
                                </li>
                            ))}
                        </ul>
                    </SectionCard>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Revenue analysis"
                meta={
                    <>
                        <span>Financial performance and revenue breakdown</span>
                        <span aria-hidden="true">·</span>
                        <span className="whitespace-nowrap">{periodDisplay}</span>
                    </>
                }
                actions={
                    <>
                        <SegmentedControl<Period>
                            ariaLabel="Reporting period"
                            value={period}
                            onChange={setPeriod}
                            options={PERIOD_OPTIONS}
                        />
                        <Button icon={RefreshCw} loading={isRefreshing} onClick={handleRefresh}>
                            {isRefreshing ? 'Refreshing…' : 'Refresh'}
                        </Button>
                        <Button variant="primary" icon={Download} onClick={handleExport}>
                            Export report
                        </Button>
                    </>
                }
            />

            {error && (
                <div
                    role="alert"
                    className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-status-danger-edge bg-status-danger-bg px-4 py-2.5 text-sm text-status-danger-fg"
                >
                    <span className="inline-flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {error}
                    </span>
                    <Button size="sm" icon={RefreshCw} loading={isRefreshing} onClick={handleRefresh}>
                        Retry
                    </Button>
                </div>
            )}

            <p role="status" aria-live="polite" className="sr-only">
                {isRefreshing
                    ? 'Refreshing revenue data'
                    : `Revenue analysis for ${periodDisplay.toLowerCase()} loaded. ${analytics.meta.inPeriodBillsCount} bills in period.`}
            </p>

            {/* KPI row — full-paid bills only; no outstanding */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <KpiTile
                    label="Total revenue"
                    value={formatCurrency(analytics.stats.totalRevenue)}
                    icon={TrendingUp}
                    delta={growthDelta}
                />
                <KpiTile
                    label="Collections"
                    value={formatCurrency(analytics.stats.totalCollections)}
                    icon={Wallet}
                    note={`${analytics.stats.collectionRate}% collection rate`}
                />
                <KpiTile
                    label="Transactions"
                    value={analytics.stats.transactions.toLocaleString()}
                    icon={Receipt}
                    note={`${analytics.meta.paidBillsCount} paid of ${analytics.meta.inPeriodBillsCount} bills`}
                />
            </div>

            {/* Charts row */}
            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Revenue trend */}
                <SectionCard title="Revenue trend" className="lg:col-span-2" bodyClassName="px-2 pb-2 pt-3">
                    <figure className="m-0">
                        <figcaption className="sr-only">
                            {hasRevenueData
                                ? `Revenue ${formatCurrency(analytics.stats.totalRevenue)} and collections ${formatCurrency(analytics.stats.totalCollections)} ${periodDisplay.toLowerCase()}.`
                                : `No revenue recorded ${periodDisplay.toLowerCase()}.`}
                        </figcaption>
                        <div className="h-72">
                            {hasRevenueData ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analytics.chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={SERIES_REVENUE} stopOpacity={0.15} />
                                                <stop offset="95%" stopColor={SERIES_REVENUE} stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorCollections" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={SERIES_COLLECTIONS} stopOpacity={0.15} />
                                                <stop offset="95%" stopColor={SERIES_COLLECTIONS} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" vertical={false} />
                                        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                                        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--edge-strong)' }} />
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                                        <Area type="monotone" dataKey="revenue" name="Revenue" stroke={SERIES_REVENUE} fill="url(#colorRevenue)" strokeWidth={2} />
                                        <Area type="monotone" dataKey="collections" name="Collections" stroke={SERIES_COLLECTIONS} fill="url(#colorCollections)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyState
                                    icon={BarChart3}
                                    title="No revenue in this period"
                                    description="Bills dated within the selected period will be charted here."
                                    compact
                                    className="h-full"
                                />
                            )}
                        </div>
                    </figure>
                </SectionCard>

                {/* Payment methods */}
                <SectionCard
                    title="Payment methods"
                    actions={
                        <Button size="sm" icon={Download} onClick={handleExportPaymentMethods} aria-label="Export payment methods">
                            Export
                        </Button>
                    }
                >
                    {analytics.paymentMethods.length === 0 ? (
                        <EmptyState
                            icon={CreditCard}
                            title="No payments recorded"
                            description="Payment method split appears once paid bills exist in this period."
                            compact
                        />
                    ) : (
                        <>
                            <figure className="m-0">
                                <figcaption className="sr-only">
                                    Payment method share: {analytics.paymentMethods.map((m) => `${m.name} ${m.value}%`).join(', ')}.
                                </figcaption>
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={analytics.paymentMethods} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4} stroke="var(--surface)">
                                                {analytics.paymentMethods.map((entry, i) => (
                                                    <Cell key={i} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={TOOLTIP_STYLE}
                                                itemStyle={{ color: 'var(--fg)' }}
                                                formatter={(value) => [`${value}%`, 'Share']}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </figure>
                            <ul className="mt-2 space-y-1.5 text-xs">
                                {analytics.paymentMethods.map((m) => (
                                    <li key={m.name} className="flex items-center justify-between gap-2">
                                        <span className="flex min-w-0 items-center gap-2 text-fg-secondary">
                                            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                                            <span className="truncate">{m.name}</span>
                                        </span>
                                        <span className="font-medium tabular-nums text-fg">{m.value}%</span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </SectionCard>
            </div>

            {/* Category + top tests */}
            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <SectionCard
                    title="Revenue by category"
                    actions={
                        <Button size="sm" icon={Download} onClick={handleExportCategoryRevenue} aria-label="Export revenue by category">
                            Export
                        </Button>
                    }
                    bodyClassName="px-2 pb-2 pt-3"
                >
                    <figure className="m-0">
                        <figcaption className="sr-only">
                            {analytics.categoryRevenue.length > 0
                                ? `Revenue by category: ${analytics.categoryRevenue.map((c) => `${c.category} ${formatCurrency(c.revenue)}`).join(', ')}.`
                                : 'No category revenue in this period.'}
                        </figcaption>
                        <div className="h-60">
                            {analytics.categoryRevenue.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.categoryRevenue} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--edge)" vertical={false} />
                                        <XAxis dataKey="category" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--primary-soft)' }} />
                                        <Bar dataKey="revenue" name="Revenue" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyState
                                    icon={BarChart3}
                                    title="No category revenue"
                                    description="Test line items on non-cancelled orders are grouped here."
                                    compact
                                    className="h-full"
                                />
                            )}
                        </div>
                    </figure>
                </SectionCard>

                <SectionCard
                    title="Top performing tests"
                    count={analytics.topTests.length > 0 ? analytics.topTests.length : undefined}
                    flush
                    actions={
                        <Button size="sm" icon={Download} onClick={handleExportTopTests} aria-label="Export top performing tests">
                            Export
                        </Button>
                    }
                >
                    {analytics.topTests.length === 0 ? (
                        <EmptyState
                            icon={FlaskConical}
                            title="No tests billed yet"
                            description="The five highest-revenue tests for the period will be listed here."
                            compact
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[480px] table-fixed text-left text-sm">
                                <caption className="sr-only">Top performing tests by revenue</caption>
                                <thead>
                                    <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                        <th scope="col" className="py-2 pl-4 pr-3 font-semibold">Test</th>
                                        <th scope="col" className="w-20 px-3 py-2 text-right font-semibold">Orders</th>
                                        <th scope="col" className="w-36 px-3 py-2 text-right font-semibold">Revenue</th>
                                        <th scope="col" className="w-24 py-2 pl-3 pr-4 text-right font-semibold">Trend</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {analytics.topTests.map((test) => (
                                        <tr key={test.name} className="transition-colors hover:bg-surface-hover">
                                            <td className="truncate py-2 pl-4 pr-3 font-medium text-fg" title={test.name}>
                                                {test.name}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-fg-secondary">{test.orders}</td>
                                            <td className="px-3 py-2 text-right font-medium tabular-nums text-fg">{formatCurrency(test.revenue)}</td>
                                            <td className="py-2 pl-3 pr-4 text-right">
                                                <TrendCell trend={test.trend} up={test.up} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* Revenue report access log */}
            {hasPermission('view_audit_log') && (
                <SectionCard
                    title="Revenue report access log"
                    count={showAuditLog && !auditLoading && !auditError ? auditLogs.length : undefined}
                    flush
                    actions={
                        <Button
                            size="sm"
                            variant="ghost"
                            icon={showAuditLog ? ChevronUp : ChevronDown}
                            aria-expanded={showAuditLog}
                            aria-controls={showAuditLog ? 'revenue-audit-log' : undefined}
                            onClick={() => setShowAuditLog((v) => !v)}
                        >
                            {showAuditLog ? 'Hide log' : 'Show log'}
                        </Button>
                    }
                >
                    <p className={cn('px-4 py-2.5 text-xs text-fg-muted', showAuditLog && 'border-b border-edge')}>
                        Signed in as <span className="font-medium text-fg-secondary">{signedInName}</span>
                        {signedInRoles !== '—' && (
                            <>
                                <span aria-hidden="true"> · </span>
                                <span>{signedInRoles}</span>
                            </>
                        )}
                    </p>

                    {showAuditLog && (
                        <div id="revenue-audit-log" aria-busy={auditLoading}>
                            {auditLoading ? (
                                <>
                                    <p role="status" aria-live="polite" className="sr-only">
                                        Loading access log
                                    </p>
                                    <ul aria-hidden="true" className="divide-y divide-edge">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                                <span className="h-3 w-20 shrink-0 rounded bg-skeleton" />
                                                <span className="h-3 w-36 shrink-0 rounded bg-skeleton" />
                                                <span className="hidden h-3 w-28 rounded bg-skeleton md:block" />
                                                <span className="h-4 w-14 rounded bg-skeleton" />
                                                <span className="ml-auto hidden h-3 w-1/4 rounded bg-skeleton lg:block" />
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : auditError ? (
                                <div role="alert">
                                    <EmptyState
                                        icon={AlertTriangle}
                                        title="Couldn't load the access log"
                                        description={auditError}
                                        compact
                                    />
                                </div>
                            ) : auditLogs.length === 0 ? (
                                <EmptyState
                                    icon={History}
                                    title="No access events yet"
                                    description="Views and exports of this report are recorded here."
                                    compact
                                />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[760px] table-fixed text-left text-sm lg:min-w-[870px]">
                                        <caption className="sr-only">Revenue report access events</caption>
                                        <thead>
                                            <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                                <th scope="col" className="w-32 py-2 pl-4 pr-3 font-semibold">Time</th>
                                                <th scope="col" className="w-48 px-3 py-2 font-semibold">Action</th>
                                                <th scope="col" className="w-40 px-3 py-2 font-semibold">User</th>
                                                <th scope="col" className="w-24 px-3 py-2 font-semibold">Branch</th>
                                                <th scope="col" className="px-3 py-2 font-semibold">Details</th>
                                                <th scope="col" className="hidden w-32 px-3 py-2 font-semibold lg:table-cell">IP address</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-edge whitespace-nowrap">
                                            {auditLogs.map((entry) => (
                                                <tr key={entry.id} className="transition-colors hover:bg-surface-hover">
                                                    <td className="py-2 pl-4 pr-3 tabular-nums text-fg-secondary">
                                                        {entry.timestamp ? (
                                                            <time dateTime={entry.timestamp} title={formatDateTime(entry.timestamp)}>
                                                                {formatAuditTime(entry.timestamp)}
                                                            </time>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                    <td className="truncate px-3 py-2 font-medium text-fg" title={formatRevenueAuditAction(entry.action)}>
                                                        {formatRevenueAuditAction(entry.action)}
                                                    </td>
                                                    <td className="truncate px-3 py-2 text-fg-secondary" title={entry.performedBy || undefined}>
                                                        {entry.performedBy || '—'}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <StatusChip size="sm">{entry.branchCode || '—'}</StatusChip>
                                                    </td>
                                                    <td className="truncate px-3 py-2 text-fg-secondary" title={entry.details || undefined}>
                                                        {entry.details || '—'}
                                                    </td>
                                                    <td className="hidden truncate px-3 py-2 font-mono text-xs text-fg-muted lg:table-cell" title={entry.ipAddress || undefined}>
                                                        {entry.ipAddress || '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </SectionCard>
            )}
        </div>
    );
}
