'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Package, PackagePlus, Plus, RefreshCw, Search, X, XCircle } from 'lucide-react';
import type { Supply } from '@/types/sample-lifecycle';
import { adjustSupplyStock, createSupply, getLabTests, getSupplies } from '@/lib/api';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import StatusChip, { type ChipTone } from '@/components/ui/StatusChip';
import { InputField, SelectField } from '@/components/ui/Field';
import StatCard from '@/components/shared/StatCard';
import { formatRegistered } from '@/components/patient-dashboard/dashboard-data';

type RawSupply = {
    id?: string | number;
    supplyId?: string | number;
    itemNo?: string | number;
    itemNumber?: string | number;
    name?: string;
    category?: string;
    tubeType?: string;
    tubeColor?: string;
    currentStock?: number | string;
    stockQuantity?: number | string;
    minStock?: number | string;
    minimumStock?: number | string;
    maxStock?: number | string;
    maximumStock?: number | string;
    unit?: string;
    lastRestocked?: string;
    updatedAt?: string;
    expiryDate?: string;
};

type RawLabTest = {
    id?: string | number;
    testName?: string;
    name?: string;
    testCode?: string;
    tubeType?: string;
};

type CatalogTest = {
    id: string;
    name: string;
    tubeType: string;
};

type InventorySupply = Supply & {
    itemNo?: string;
    tubeType?: string;
};

const DEFAULT_UNIT = 'units';
const ALL_TUBES = 'All Tubes';
const SKELETON_ROWS = 6;

type StockStatus = { label: string; tone: ChipTone; bar: string };

/** Stock level → chip tone. Out of stock = danger, below minimum = pending, otherwise in stock. */
function getStockStatus(current: number, min: number): StockStatus {
    if (current <= 0) return { label: 'Out of stock', tone: 'danger', bar: 'bg-status-danger' };
    if (current < min) return { label: 'Low stock', tone: 'pending', bar: 'bg-status-pending' };
    return { label: 'In stock', tone: 'success', bar: 'bg-status-verified' };
}

/** Fill percentage of the stock bar; a zero/unknown maximum renders an empty bar instead of NaN. */
function getStockPercent(current: number, max: number) {
    if (!Number.isFinite(max) || max <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((current / max) * 100)));
}

/** Backend sends "2026-08-10" (or "-" when unknown) or a full timestamp; render as "10 Aug 2026" / "Today 09:12". */
function formatRestocked(value?: string) {
    if (!value || value === '-') return '—';
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
        const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return formatRegistered(date);
}

/** "EDTA_PURPLE" → "Edta Purple" — tube codes are sentence-cased before they reach the UI. */
function formatTubeType(tubeType: string) {
    return tubeType
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeSupplies(list: RawSupply[]): InventorySupply[] {
    return list.map((item) => ({
        id: String(item?.id ?? item?.supplyId ?? ''),
        itemNo: item?.itemNo || item?.itemNumber ? String(item.itemNo ?? item.itemNumber) : undefined,
        name: String(item?.name ?? 'Unnamed Supply'),
        category: String(item?.category ?? 'Other'),
        tubeType: item?.tubeType ? String(item.tubeType) : undefined,
        tubeColor: item?.tubeColor ? String(item.tubeColor) : undefined,
        currentStock: Number(item?.currentStock ?? item?.stockQuantity ?? 0),
        minStock: Number(item?.minStock ?? item?.minimumStock ?? 0),
        maxStock: Number(item?.maxStock ?? item?.maximumStock ?? 0),
        unit: String(item?.unit ?? 'units'),
        lastRestocked: String(item?.lastRestocked ?? item?.updatedAt ?? '-'),
        expiryDate: String(item?.expiryDate ?? '-'),
    }));
}

// Tests without a tube cannot be stocked and can never match an inventory row.
function normalizeLabTests(list: RawLabTest[]): CatalogTest[] {
    return list
        .filter((item) => Boolean(item?.tubeType))
        .map((item) => ({
            id: String(item?.id ?? ''),
            name: String(item?.testName ?? item?.name ?? item?.testCode ?? 'Unnamed Test'),
            tubeType: String(item.tubeType),
        }));
}

function generateNextItemNo(supplies: InventorySupply[]) {
    const maxNumber = supplies.reduce((max, supply) => {
        const raw = supply.itemNo ?? '';
        const supMatch = raw.match(/SUP-(\d+)/i);
        const itmMatch = raw.match(/ITM-(\d+)/i);
        const value = supMatch ? Number(supMatch[1]) : itmMatch ? Number(itmMatch[1]) : 0;
        return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);

    return `SUP-${String(maxNumber + 1).padStart(4, '0')}`;
}

// Item colours are stored data (sent to the API and shown as the item dot), not UI styling.
function generateColor(seed: number) {
    const value = (seed * 2654435761) % 16777215;
    return `#${Math.floor(value).toString(16).padStart(6, '0')}`;
}

const FALLBACK_ITEM_COLOR = '#64748b';

// A refused stock movement carries the shelf count that refused it, which is the only useful thing to show.
function resolveErrorMessage(err: unknown, fallback: string) {
    const backendMessage = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    if (typeof backendMessage === 'string' && backendMessage.trim()) return backendMessage;
    return err instanceof Error ? err.message : fallback;
}

function getNextAvailableColor(supplies: InventorySupply[]) {
    const used = new Set(supplies.map((supply) => supply.tubeColor?.toLowerCase()).filter(Boolean));
    for (let index = supplies.length + 1; index < supplies.length + 256; index += 1) {
        const color = generateColor(index);
        if (!used.has(color.toLowerCase())) return color;
    }
    return FALLBACK_ITEM_COLOR;
}

/**
 * Stored tube colour rendered as a small dot (literal colour by design, ringed so it reads on both themes).
 * Pass `decorative` where the hex is already written out next to the dot, so it is not announced twice;
 * everywhere else the dot names itself, since a swatch alone conveys nothing to a screen reader.
 */
function ItemColorDot({ color, className, decorative }: { color?: string; className?: string; decorative?: boolean }) {
    if (!color) return null;
    const hex = color.toUpperCase();
    return (
        <span
            role={decorative ? undefined : 'img'}
            aria-hidden={decorative || undefined}
            aria-label={decorative ? undefined : `Tube colour ${hex}`}
            title={hex}
            className={cn('inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-edge', className)}
            style={{ backgroundColor: color }}
        />
    );
}

export default function SuppliesPage() {
    const [supplies, setSupplies] = useState<InventorySupply[]>([]);
    const [labTests, setLabTests] = useState<CatalogTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [addError, setAddError] = useState<string | null>(null);
    const [refillError, setRefillError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showRefillModal, setShowRefillModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [tubeFilter, setTubeFilter] = useState(ALL_TUBES);
    const [form, setForm] = useState({
        testId: '',
        name: '',
        color: FALLBACK_ITEM_COLOR,
        currentStock: '',
        minStock: '',
        maxStock: '',
    });
    const [refillForm, setRefillForm] = useState({
        supplyId: '',
        quantity: '',
    });
    const colorInputId = useId();

    const fetchSupplies = useCallback(async (showPageLoading = true) => {
        try {
            if (showPageLoading) setLoading(true);
            setError(null);
            const data = await getSupplies();
            const list = data?.content ?? data ?? [];
            setSupplies(normalizeSupplies(Array.isArray(list) ? list as RawSupply[] : []));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load supplies.');
            setSupplies([]);
        } finally {
            if (showPageLoading) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSupplies(true);
    }, [fetchSupplies]);

    // A missing catalog only costs the Test column; the inventory itself still stands.
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const data = await getLabTests();
                if (!active) return;
                setLabTests(normalizeLabTests(Array.isArray(data) ? data as RawLabTest[] : []));
            } catch {
                if (active) setLabTests([]);
            }
        })();

        return () => {
            active = false;
        };
    }, []);

    const testsByTube = useMemo(() => {
        const map = new Map<string, string[]>();
        labTests.forEach((test) => {
            const names = map.get(test.tubeType) ?? [];
            names.push(test.name);
            map.set(test.tubeType, names);
        });
        return map;
    }, [labTests]);

    const tubeOptions = useMemo(() => {
        const present = supplies
            .map((supply) => supply.tubeType)
            .filter((tubeType): tubeType is string => Boolean(tubeType));
        return Array.from(new Set(present)).sort();
    }, [supplies]);

    const filtered = useMemo(() => {
        return supplies.filter((s) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.itemNo?.toLowerCase().includes(q);
            const matchesTube = tubeFilter === ALL_TUBES || s.tubeType === tubeFilter;
            return matchesSearch && matchesTube;
        });
    }, [supplies, searchQuery, tubeFilter]);

    const outOfStockCount = supplies.filter((s) => s.currentStock <= 0).length;
    const lowStockCount = supplies.filter((s) => s.currentStock > 0 && s.currentStock < s.minStock).length;
    const inStockCount = supplies.length - outOfStockCount - lowStockCount;
    const nextItemNo = useMemo(() => generateNextItemNo(supplies), [supplies]);
    const usedColors = useMemo(() => new Set(supplies.map((supply) => supply.tubeColor?.toLowerCase()).filter(Boolean)), [supplies]);
    const colorInUse = usedColors.has(form.color.toLowerCase());
    const hasFilters = Boolean(searchQuery) || tubeFilter !== ALL_TUBES;

    // The tube is never typed in: it follows from the test, and an already-stocked tube must be refilled instead.
    const derivedTube = useMemo(() => {
        const test = labTests.find((item) => item.id === form.testId);
        if (!test) return null;

        const stocked = supplies.find((supply) => supply.tubeType === test.tubeType);
        return {
            tubeType: test.tubeType,
            name: stocked?.name ?? formatTubeType(test.tubeType),
            color: stocked?.tubeColor ?? form.color,
            stockedAs: stocked?.itemNo ?? null,
        };
    }, [labTests, supplies, form.testId, form.color]);

    const resetForm = useCallback(() => {
        setAddError(null);
        setForm({
            testId: '',
            name: '',
            color: getNextAvailableColor(supplies),
            currentStock: '',
            minStock: '',
            maxStock: '',
        });
    }, [supplies]);

    const handleTestChange = (testId: string) => {
        setAddError(null);
        const test = labTests.find((item) => item.id === testId);
        if (!test) {
            setForm((prev) => ({ ...prev, testId }));
            return;
        }

        const stocked = supplies.find((supply) => supply.tubeType === test.tubeType);
        setForm((prev) => ({
            ...prev,
            testId,
            name: stocked?.name ?? formatTubeType(test.tubeType),
            color: stocked?.tubeColor ?? getNextAvailableColor(supplies),
        }));
    };

    const handleColorChange = (color: string) => {
        if (usedColors.has(color.toLowerCase())) {
            setAddError('This item color is already used. Select a different color.');
            return;
        }

        setAddError(null);
        setForm((prev) => ({ ...prev, color }));
    };

    const resetRefillForm = useCallback(() => {
        setRefillError(null);
        setRefillForm({
            supplyId: supplies[0]?.id ?? '',
            quantity: '',
        });
    }, [supplies]);

    const openAddModal = () => {
        setForm((prev) => ({ ...prev, color: getNextAvailableColor(supplies) }));
        setShowAddModal(true);
        setAddError(null);
    };

    // Stable close handlers: Modal re-runs its focus effect when onClose changes.
    const closeAddModal = useCallback(() => {
        setShowAddModal(false);
        resetForm();
    }, [resetForm]);

    /** Opens the refill dialog; pass an id (row action) to preselect that item. */
    const openRefillModal = (supplyId?: string) => {
        setRefillForm((prev) => ({ ...prev, supplyId: supplyId ?? (prev.supplyId || supplies[0]?.id || '') }));
        setShowRefillModal(true);
        setRefillError(null);
    };

    const closeRefillModal = useCallback(() => {
        setShowRefillModal(false);
        resetRefillForm();
    }, [resetRefillForm]);

    const clearFilters = () => {
        setSearchQuery('');
        setTubeFilter(ALL_TUBES);
    };

    const handleCreateSupply = async (e: React.FormEvent) => {
        e.preventDefault();
        const currentStock = Number(form.currentStock);
        const minStock = Number(form.minStock);
        const maxStock = Number(form.maxStock);
        const nextName = form.name.trim();

        if (!derivedTube) {
            setAddError('Select a test so the tube can be derived.');
            return;
        }
        if (derivedTube.stockedAs) {
            setAddError(`This tube is already stocked as ${derivedTube.stockedAs}. Refill that item instead.`);
            return;
        }
        if (!nextName) {
            setAddError('Tube name is required.');
            return;
        }
        if (supplies.some((supply) => supply.name.trim().toLowerCase() === nextName.toLowerCase())) {
            setAddError('An inventory item with this name already exists.');
            return;
        }
        if (usedColors.has(form.color.toLowerCase())) {
            setAddError('This item color is already used. Select a different color.');
            return;
        }
        if ([currentStock, minStock, maxStock].some((v) => Number.isNaN(v) || v < 0)) {
            setAddError('Stock values must be valid non-negative numbers.');
            return;
        }
        if (maxStock < minStock) {
            setAddError('Max stock must be greater than or equal to min stock.');
            return;
        }

        try {
            setSubmitting(true);
            setAddError(null);
            await createSupply({
                itemNo: nextItemNo,
                itemNumber: nextItemNo,
                name: nextName,
                tubeType: derivedTube.tubeType,
                testId: form.testId,
                currentStock,
                minStock,
                maxStock,
                unit: DEFAULT_UNIT,
                tubeColor: form.color,
            });
            setShowAddModal(false);
            resetForm();
            await fetchSupplies(false);
        } catch (err: unknown) {
            setAddError(err instanceof Error ? err.message : 'Failed to create supply item.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRefillSupply = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedSupply = supplies.find((s) => s.id === refillForm.supplyId);
        const quantity = Number(refillForm.quantity);

        if (!selectedSupply) {
            setRefillError('Select an inventory item to refill.');
            return;
        }
        if (Number.isNaN(quantity) || quantity <= 0) {
            setRefillError('Refill quantity must be greater than zero.');
            return;
        }

        try {
            setSubmitting(true);
            setRefillError(null);
            // The server applies the delta to the count on the shelf and answers with the total it reached.
            const [refilled] = normalizeSupplies([await adjustSupplyStock(selectedSupply.id, quantity)]);
            setSupplies((prev) => prev.map((supply) => (supply.id === refilled.id ? refilled : supply)));
            setShowRefillModal(false);
            resetRefillForm();
        } catch (err: unknown) {
            setRefillError(resolveErrorMessage(err, 'Failed to refill inventory item.'));
        } finally {
            setSubmitting(false);
        }
    };

    const selectedRefillSupply = refillForm.supplyId ? supplies.find((supply) => supply.id === refillForm.supplyId) : undefined;
    const selectedRefillStatus = selectedRefillSupply ? getStockStatus(selectedRefillSupply.currentStock, selectedRefillSupply.minStock) : null;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                crumbs={[{ label: 'Phlebotomy', href: '/phlebotomy/worklist' }, { label: 'Supplies' }]}
                title="Supplies"
                meta={<span>Stock is counted per tube and drawn down as samples are collected.</span>}
                actions={
                    <>
                        <Button icon={RefreshCw} onClick={() => void fetchSupplies(true)} loading={loading && supplies.length > 0} disabled={loading}>
                            Refresh
                        </Button>
                        <Button icon={PackagePlus} onClick={() => openRefillModal()} disabled={loading}>
                            Refill item
                        </Button>
                        <Button variant="primary" icon={Plus} onClick={openAddModal} disabled={loading}>
                            Add item
                        </Button>
                    </>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading supplies'
                    : error
                      ? 'Supplies failed to load'
                      : `Supplies loaded. ${supplies.length} items${lowStockCount + outOfStockCount > 0 ? `, ${lowStockCount + outOfStockCount} need restocking` : ''}.`}
            </p>

            {/* Stats */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Total items" value={supplies.length} icon={Package} color="blue" loading={loading} />
                <StatCard label="In stock" value={inStockCount} icon={CheckCircle2} color="emerald" loading={loading} />
                <StatCard label="Low stock" value={lowStockCount} icon={AlertTriangle} color="orange" sub="Below minimum level" loading={loading} />
                <StatCard label="Out of stock" value={outOfStockCount} icon={XCircle} color="red" loading={loading} />
            </div>

            <SectionCard title="Inventory" count={loading ? undefined : filtered.length} flush>
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <InputField
                        label="Search supplies"
                        hideLabel
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by item name or number"
                        autoComplete="off"
                        className="min-w-[200px] flex-1"
                    />
                    <SelectField
                        label="Tube type"
                        hideLabel
                        value={tubeFilter}
                        onChange={(e) => setTubeFilter(e.target.value)}
                        className="w-full sm:w-48"
                    >
                        <option value={ALL_TUBES}>All tubes</option>
                        {tubeOptions.map((tubeType) => (
                            <option key={tubeType} value={tubeType}>
                                {formatTubeType(tubeType)}
                            </option>
                        ))}
                    </SelectField>
                    {hasFilters && (
                        <Button variant="ghost" icon={X} onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </div>

                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-3 shrink-0 rounded-full bg-skeleton" />
                                <span className="h-4 w-40 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-28 rounded bg-skeleton md:block" />
                                <span className="h-3 w-32 rounded bg-skeleton" />
                                <span className="hidden h-3 w-10 rounded bg-skeleton lg:block" />
                                <span className="h-4 w-20 rounded bg-skeleton" />
                                <span className="ml-auto hidden h-3 w-24 rounded bg-skeleton lg:block" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Couldn't load supplies"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => void fetchSupplies(true)}>
                                Retry
                            </Button>
                        }
                    />
                ) : filtered.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={Search}
                            title="No supplies match"
                            description="Try a different search term or tube type."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Package}
                            title="No supplies yet"
                            description="Stock a tube for a test so collections can draw it down."
                            action={
                                <Button size="sm" variant="primary" icon={Plus} onClick={openAddModal}>
                                    Add item
                                </Button>
                            }
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        {/* Fixed widths per band: base 704 · md 912 · lg 1136 — each under its min-w */}
                        <table className="w-full min-w-[760px] table-fixed text-left text-sm md:min-w-[940px] lg:min-w-[1180px]">
                            <caption className="sr-only">Supplies inventory</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-64 py-2 pl-4 pr-3 font-semibold">Item</th>
                                    <th scope="col" className="hidden w-52 px-3 py-2 font-semibold md:table-cell">Tests</th>
                                    <th scope="col" className="w-56 px-3 py-2 font-semibold">Stock</th>
                                    <th scope="col" className="hidden w-20 px-3 py-2 text-right font-semibold lg:table-cell">Min</th>
                                    <th scope="col" className="w-32 px-3 py-2 font-semibold">Status</th>
                                    <th scope="col" className="hidden w-36 px-3 py-2 font-semibold lg:table-cell">Last restocked</th>
                                    <th scope="col" className="w-24 py-2 pl-3 pr-4 text-right font-semibold">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {filtered.map((supply) => {
                                    const status = getStockStatus(supply.currentStock, supply.minStock);
                                    const pct = getStockPercent(supply.currentStock, supply.maxStock);
                                    const testNames = supply.tubeType ? testsByTube.get(supply.tubeType) ?? [] : [];
                                    const hiddenCount = testNames.length - 2;
                                    const testLabel = testNames.length === 0
                                        ? '—'
                                        : `${testNames.slice(0, 2).join(', ')}${hiddenCount > 0 ? ` +${hiddenCount} more` : ''}`;
                                    return (
                                        <tr key={supply.id} className="transition-colors hover:bg-surface-hover">
                                            <td className="py-2 pl-4 pr-3">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <ItemColorDot color={supply.tubeColor} decorative />
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-fg" title={supply.name}>{supply.name}</p>
                                                        <p className="truncate text-xs text-fg-muted">
                                                            {supply.itemNo ?? '—'}
                                                            {supply.tubeType && <span> · {formatTubeType(supply.tubeType)}</span>}
                                                            {/* The dot shows the colour; the stored value itself has to be legible too. */}
                                                            {supply.tubeColor && (
                                                                <span> · <span className="font-mono uppercase">{supply.tubeColor}</span></span>
                                                            )}
                                                            {testNames.length > 0 && <span className="md:hidden"> · {testLabel}</span>}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td
                                                className="hidden truncate px-3 py-2 text-fg-secondary md:table-cell"
                                                title={testNames.length > 0 ? testNames.join(', ') : undefined}
                                            >
                                                {testLabel}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div aria-hidden="true" className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-edge">
                                                        <div className={cn('h-full rounded-full', status.bar)} style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className="tabular-nums text-fg">
                                                        {supply.currentStock} / {supply.maxStock} {supply.unit}
                                                    </span>
                                                    <span className="tabular-nums text-xs text-fg-muted">{pct}%</span>
                                                </div>
                                            </td>
                                            <td className="hidden px-3 py-2 text-right tabular-nums text-fg-secondary lg:table-cell">
                                                {supply.minStock}
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusChip tone={status.tone} dot size="sm">
                                                    {status.label}
                                                </StatusChip>
                                            </td>
                                            <td className="hidden px-3 py-2 text-fg-secondary lg:table-cell">
                                                {formatRestocked(supply.lastRestocked)}
                                            </td>
                                            <td className="py-2 pl-3 pr-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    icon={PackagePlus}
                                                    onClick={() => openRefillModal(supply.id)}
                                                    aria-label={`Refill ${supply.name}`}
                                                >
                                                    Refill
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            {/* Add item dialog */}
            <Modal
                open={showAddModal}
                onClose={closeAddModal}
                title="Add inventory item"
                description="Pick the test — the tube follows from it, and the item is numbered automatically."
                size="md"
                dismissible={!submitting}
                footer={
                    <>
                        <Button onClick={closeAddModal} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" form="add-supply-form" variant="primary" loading={submitting}>
                            Save item
                        </Button>
                    </>
                }
            >
                <form id="add-supply-form" onSubmit={handleCreateSupply} className="space-y-4">
                    {addError && (
                        <div role="alert" className="rounded-md bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg ring-1 ring-inset ring-status-danger-edge">
                            {addError}
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <SelectField
                            label="Test"
                            value={form.testId}
                            onChange={(e) => handleTestChange(e.target.value)}
                            hint={labTests.length === 0 ? 'Test catalog unavailable — reload to try again.' : 'The tube is derived from the test.'}
                            required
                            className="sm:col-span-2"
                        >
                            <option value="">Select test</option>
                            {labTests.map((test) => (
                                <option key={test.id} value={test.id}>
                                    {test.name}
                                </option>
                            ))}
                        </SelectField>
                        {derivedTube && (
                            <div className="min-w-0 rounded-md border border-edge bg-surface-muted px-3 py-2 sm:col-span-2">
                                <p className="text-xs font-medium text-fg-secondary">Tube for this test</p>
                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                                    <ItemColorDot color={derivedTube.color} />
                                    <span className="min-w-0 truncate text-sm font-medium text-fg" title={derivedTube.name}>
                                        {derivedTube.name}
                                    </span>
                                    <StatusChip size="sm">{formatTubeType(derivedTube.tubeType)}</StatusChip>
                                </div>
                                {derivedTube.stockedAs && (
                                    <p className="mt-1.5 text-xs text-status-pending-fg">
                                        Already stocked as {derivedTube.stockedAs} — refill that item instead.
                                    </p>
                                )}
                            </div>
                        )}
                        <InputField label="Item no" value={nextItemNo} readOnly hint="Assigned automatically" />
                        <InputField
                            label="Tube name"
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g. EDTA tube 4 ml"
                            autoComplete="off"
                            required
                        />
                        {/* Colour picker composed inline: the Field primitive has no swatch control */}
                        <div className="min-w-0 sm:col-span-2">
                            <label htmlFor={colorInputId} className="mb-1 block text-xs font-medium text-fg-secondary">
                                Tube colour
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    id={colorInputId}
                                    type="color"
                                    value={form.color}
                                    onChange={(e) => handleColorChange(e.target.value)}
                                    aria-invalid={colorInUse ? true : undefined}
                                    aria-describedby={`${colorInputId}-hint`}
                                    className="h-9 w-14 cursor-pointer rounded-md border border-edge bg-surface p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                                />
                                <span className={cn('font-mono text-sm font-medium uppercase', colorInUse ? 'text-status-danger-fg' : 'text-fg')}>
                                    {form.color}
                                </span>
                            </div>
                            <p id={`${colorInputId}-hint`} className={cn('mt-1 text-xs', colorInUse ? 'text-status-danger-fg' : 'text-fg-muted')}>
                                {colorInUse ? 'This colour is already used by another item.' : 'Shown as the dot next to the item name.'}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <InputField
                            label="Current"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder="0"
                            value={form.currentStock}
                            onChange={(e) => setForm((prev) => ({ ...prev, currentStock: e.target.value }))}
                            required
                        />
                        <InputField
                            label="Minimum"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder="0"
                            value={form.minStock}
                            onChange={(e) => setForm((prev) => ({ ...prev, minStock: e.target.value }))}
                            required
                        />
                        <InputField
                            label="Maximum"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder="0"
                            value={form.maxStock}
                            onChange={(e) => setForm((prev) => ({ ...prev, maxStock: e.target.value }))}
                            required
                        />
                    </div>
                    <p className="text-xs text-fg-muted">Stock is counted in {DEFAULT_UNIT}. Items below the minimum are flagged as low stock.</p>
                </form>
            </Modal>

            {/* Refill dialog */}
            <Modal
                open={showRefillModal}
                onClose={closeRefillModal}
                title="Refill inventory item"
                description="Adds the quantity to the count on the shelf; the server answers with the total it reached."
                size="sm"
                dismissible={!submitting}
                footer={
                    supplies.length === 0 ? (
                        <Button onClick={closeRefillModal}>Close</Button>
                    ) : (
                        <>
                            <Button onClick={closeRefillModal} disabled={submitting}>
                                Cancel
                            </Button>
                            <Button type="submit" form="refill-supply-form" variant="primary" loading={submitting}>
                                Refill item
                            </Button>
                        </>
                    )
                }
            >
                {supplies.length === 0 ? (
                    <EmptyState compact icon={Package} title="No items to refill" description="Add an inventory item first." />
                ) : (
                    <form id="refill-supply-form" onSubmit={handleRefillSupply} className="space-y-4">
                        {refillError && (
                            <div role="alert" className="rounded-md bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg ring-1 ring-inset ring-status-danger-edge">
                                {refillError}
                            </div>
                        )}
                        <SelectField
                            label="Inventory item"
                            value={refillForm.supplyId}
                            onChange={(e) => setRefillForm((prev) => ({ ...prev, supplyId: e.target.value }))}
                            required
                        >
                            <option value="">Select inventory item</option>
                            {supplies.map((supply) => (
                                <option key={supply.id} value={supply.id}>
                                    {supply.itemNo ? `${supply.itemNo} - ` : ''}{supply.name}
                                </option>
                            ))}
                        </SelectField>
                        {selectedRefillSupply && selectedRefillStatus && (
                            <div className="flex flex-wrap items-center gap-2 rounded-md border border-edge bg-surface-muted px-3 py-2 text-sm text-fg-secondary">
                                <ItemColorDot color={selectedRefillSupply.tubeColor} />
                                <span>
                                    Current stock: <span className="font-medium tabular-nums text-fg">{selectedRefillSupply.currentStock}</span> {selectedRefillSupply.unit}
                                </span>
                                <StatusChip tone={selectedRefillStatus.tone} dot size="sm" className="ml-auto">
                                    {selectedRefillStatus.label}
                                </StatusChip>
                            </div>
                        )}
                        <InputField
                            label="Refill quantity"
                            type="number"
                            min="1"
                            inputMode="numeric"
                            placeholder="0"
                            value={refillForm.quantity}
                            onChange={(e) => setRefillForm((prev) => ({ ...prev, quantity: e.target.value }))}
                            hint={selectedRefillSupply ? `Added to the current ${selectedRefillSupply.currentStock} ${selectedRefillSupply.unit}.` : undefined}
                            required
                        />
                    </form>
                )}
            </Modal>
        </div>
    );
}
