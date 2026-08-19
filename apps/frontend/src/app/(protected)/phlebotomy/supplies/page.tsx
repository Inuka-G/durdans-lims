'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Supply } from '@/types/sample-lifecycle';
import { adjustSupplyStock, createSupply, getLabTests, getSupplies } from '@/lib/api';

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

function getStockStatus(current: number, min: number) {
    if (current <= 0) return { label: 'OUT OF STOCK', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
    if (current < min) return { label: 'LOW STOCK', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
    return { label: 'IN STOCK', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
}

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

function generateColor(seed: number) {
    const value = (seed * 2654435761) % 16777215;
    return `#${Math.floor(value).toString(16).padStart(6, '0')}`;
}

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
    return '#64748b';
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
        color: '#64748b',
        currentStock: '',
        minStock: '',
        maxStock: '',
    });
    const [refillForm, setRefillForm] = useState({
        supplyId: '',
        quantity: '',
    });

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

    const lowStockCount = supplies.filter(s => s.currentStock < s.minStock).length;
    const nextItemNo = useMemo(() => generateNextItemNo(supplies), [supplies]);
    const usedColors = useMemo(() => new Set(supplies.map((supply) => supply.tubeColor?.toLowerCase()).filter(Boolean)), [supplies]);

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

    const resetForm = () => {
        setAddError(null);
        setForm({
            testId: '',
            name: '',
            color: getNextAvailableColor(supplies),
            currentStock: '',
            minStock: '',
            maxStock: '',
        });
    };

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

    const resetRefillForm = () => {
        setRefillError(null);
        setRefillForm({
            supplyId: supplies[0]?.id ?? '',
            quantity: '',
        });
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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <span className="material-icons text-5xl text-slate-300 animate-spin">progress_activity</span>
                <p className="text-sm text-slate-400 font-medium">Loading supplies...</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Supplies Inventory</h1>
                    <p className="text-sm text-slate-500 mt-1">Track collection supplies and reorder when stock is low.</p>
                    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                </div>
                <div className="flex items-center gap-2">
                    {lowStockCount > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                            <span className="material-icons text-lg text-amber-600">warning</span>
                            <span className="text-sm font-semibold text-amber-700">{lowStockCount} item(s) low stock</span>
                        </div>
                    )}
                    <button
                        onClick={() => {
                            setForm((prev) => ({ ...prev, color: getNextAvailableColor(supplies) }));
                            setShowAddModal(true);
                            setAddError(null);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
                    >
                        <span className="material-icons text-base">add</span>
                        Add New Item
                    </button>
                    <button
                        onClick={() => {
                            setRefillForm((prev) => ({ ...prev, supplyId: prev.supplyId || supplies[0]?.id || '' }));
                            setShowRefillModal(true);
                            setRefillError(null);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
                    >
                        <span className="material-icons text-base">inventory_2</span>
                        Refill Item
                    </button>
                </div>
            </div>

            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Add Inventory Item</h2>
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    resetForm();
                                }}
                                className="p-1 rounded-lg hover:bg-slate-100"
                            >
                                <span className="material-icons text-slate-500">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleCreateSupply} className="space-y-3">
                            {addError && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                                    {addError}
                                </div>
                            )}
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Item No</p>
                                <p className="text-sm font-semibold text-slate-700">{nextItemNo}</p>
                            </div>
                            <select
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={form.testId}
                                onChange={(e) => handleTestChange(e.target.value)}
                                required
                            >
                                <option value="">Select test</option>
                                {labTests.map((test) => (
                                    <option key={test.id} value={test.id}>
                                        {test.name}
                                    </option>
                                ))}
                            </select>
                            {derivedTube && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tube For This Test</p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: derivedTube.color }} />
                                        <span className="text-sm font-semibold text-slate-700">{derivedTube.name}</span>
                                        <span className="text-xs font-semibold text-slate-400">{formatTubeType(derivedTube.tubeType)}</span>
                                    </div>
                                    {derivedTube.stockedAs && (
                                        <p className="mt-1 text-xs font-semibold text-amber-600">
                                            Already stocked as {derivedTube.stockedAs} - refill that item instead.
                                        </p>
                                    )}
                                </div>
                            )}
                            <input
                                type="text"
                                placeholder="Tube name"
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                required
                            />
                            <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                                <input
                                    type="color"
                                    className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                                    value={form.color}
                                    onChange={(e) => handleColorChange(e.target.value)}
                                    aria-label="Tube colour"
                                />
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tube Colour</p>
                                    <p className={`text-sm font-semibold ${usedColors.has(form.color.toLowerCase()) ? 'text-red-600' : 'text-slate-700'}`}>
                                        {form.color.toUpperCase()}{usedColors.has(form.color.toLowerCase()) ? ' already used' : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="Current"
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    value={form.currentStock}
                                    onChange={(e) => setForm((prev) => ({ ...prev, currentStock: e.target.value }))}
                                    required
                                />
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="Min"
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    value={form.minStock}
                                    onChange={(e) => setForm((prev) => ({ ...prev, minStock: e.target.value }))}
                                    required
                                />
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="Max"
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    value={form.maxStock}
                                    onChange={(e) => setForm((prev) => ({ ...prev, maxStock: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-60"
                                >
                                    {submitting ? 'Saving...' : 'Save Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showRefillModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Refill Inventory Item</h2>
                            <button
                                onClick={() => {
                                    setShowRefillModal(false);
                                    resetRefillForm();
                                }}
                                className="p-1 rounded-lg hover:bg-slate-100"
                            >
                                <span className="material-icons text-slate-500">close</span>
                            </button>
                        </div>
                        {supplies.length === 0 ? (
                            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
                                No inventory items are available to refill.
                            </div>
                        ) : (
                            <form onSubmit={handleRefillSupply} className="space-y-3">
                                {refillError && (
                                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                                        {refillError}
                                    </div>
                                )}
                                <select
                                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                                </select>
                                {refillForm.supplyId && (() => {
                                    const selectedSupply = supplies.find((supply) => supply.id === refillForm.supplyId);
                                    if (!selectedSupply) return null;

                                    return (
                                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-600">
                                            {selectedSupply.tubeColor && <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: selectedSupply.tubeColor }} />}
                                            <span>Current stock: {selectedSupply.currentStock} {selectedSupply.unit}</span>
                                        </div>
                                    );
                                })()}
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Refill quantity"
                                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        value={refillForm.quantity}
                                        onChange={(e) => setRefillForm((prev) => ({ ...prev, quantity: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowRefillModal(false);
                                            resetRefillForm();
                                        }}
                                        className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                        {submitting ? 'Refilling...' : 'Refill Item'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="relative flex-1">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                        <input type="text" placeholder="Search supplies..." className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" value={tubeFilter} onChange={(e) => setTubeFilter(e.target.value)}>
                        <option value={ALL_TUBES}>{ALL_TUBES}</option>
                        {tubeOptions.map(tubeType => <option key={tubeType} value={tubeType}>{formatTubeType(tubeType)}</option>)}
                    </select>
                </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[12%]">Item No.</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[26%]">Test</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[20%]">Tube Name</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[14%]">Tube Colour</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[12%] text-right">Current Quantity</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[8%] text-right">Minimum Quantity</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[8%] text-right">Maximum Quantity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-sm font-semibold text-slate-400">
                                        No supplies found.
                                    </td>
                                </tr>
                            ) : filtered.map((supply) => {
                                const status = getStockStatus(supply.currentStock, supply.minStock);
                                const testNames = supply.tubeType ? testsByTube.get(supply.tubeType) ?? [] : [];
                                const visibleTests = testNames.slice(0, 2).join(', ');
                                const hiddenCount = testNames.length - 2;

                                return (
                                    <tr key={supply.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-5 px-6">
                                            <span className="text-[13px] font-extrabold text-slate-800">{supply.itemNo ?? '-'}</span>
                                        </td>
                                        <td className="py-5 px-6">
                                            {testNames.length === 0 ? (
                                                <span className="text-[13px] font-semibold text-slate-300">-</span>
                                            ) : (
                                                <span className="text-[13px] font-semibold text-slate-700" title={testNames.join(', ')}>
                                                    {visibleTests}{hiddenCount > 0 ? ` +${hiddenCount} more` : ''}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-5 px-6">
                                            <span className="text-[14px] font-bold text-slate-900">{supply.name}</span>
                                            {supply.tubeType && (
                                                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{supply.tubeType}</p>
                                            )}
                                        </td>
                                        <td className="py-5 px-6">
                                            {supply.tubeColor ? (
                                                <span className="inline-flex items-center gap-2">
                                                    <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: supply.tubeColor }} />
                                                    <span className="text-[12px] font-semibold text-slate-600">{supply.tubeColor.toUpperCase()}</span>
                                                </span>
                                            ) : (
                                                <span className="text-[13px] font-semibold text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="py-5 px-6 text-right">
                                            <span className="text-[14px] font-bold text-slate-800">{supply.currentStock}</span>
                                            <p className="mt-1">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${status.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{status.label}
                                                </span>
                                            </p>
                                        </td>
                                        <td className="py-5 px-6 text-right">
                                            <span className="text-[14px] font-semibold text-slate-600">{supply.minStock}</span>
                                        </td>
                                        <td className="py-5 px-6 text-right">
                                            <span className="text-[14px] font-semibold text-slate-600">{supply.maxStock}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
