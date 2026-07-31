'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Supply } from '@/types/sample-lifecycle';
import { createSupply, getSupplies, updateSupply } from '@/lib/api';

type RawSupply = {
    id?: string | number;
    supplyId?: string | number;
    itemNo?: string | number;
    itemNumber?: string | number;
    name?: string;
    category?: string;
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

type InventorySupply = Supply & {
    itemNo?: string;
};

const DEFAULT_UNIT = 'units';

function getStockStatus(current: number, min: number) {
    if (current <= 0) return { label: 'OUT OF STOCK', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
    if (current < min) return { label: 'LOW STOCK', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
    return { label: 'IN STOCK', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
}

function normalizeSupplies(list: RawSupply[]): InventorySupply[] {
    return list.map((item) => ({
        id: String(item?.id ?? item?.supplyId ?? ''),
        itemNo: item?.itemNo || item?.itemNumber ? String(item.itemNo ?? item.itemNumber) : undefined,
        name: String(item?.name ?? 'Unnamed Supply'),
        category: String(item?.category ?? 'Other'),
        tubeColor: item?.tubeColor ? String(item.tubeColor) : undefined,
        currentStock: Number(item?.currentStock ?? item?.stockQuantity ?? 0),
        minStock: Number(item?.minStock ?? item?.minimumStock ?? 0),
        maxStock: Number(item?.maxStock ?? item?.maximumStock ?? 0),
        unit: String(item?.unit ?? 'units'),
        lastRestocked: String(item?.lastRestocked ?? item?.updatedAt ?? '-'),
        expiryDate: String(item?.expiryDate ?? '-'),
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [addError, setAddError] = useState<string | null>(null);
    const [refillError, setRefillError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showRefillModal, setShowRefillModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [form, setForm] = useState({
        name: '',
        category: '',
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

    const categories = useMemo(() => {
        const dynamicCategories = Array.from(new Set(supplies.map((s) => s.category).filter(Boolean)));
        return ['All Categories', ...dynamicCategories];
    }, [supplies]);

    const filtered = useMemo(() => {
        return supplies.filter((s) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.itemNo?.toLowerCase().includes(q);
            const matchesCategory = categoryFilter === 'All Categories' || s.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [supplies, searchQuery, categoryFilter]);

    const lowStockCount = supplies.filter(s => s.currentStock < s.minStock).length;
    const nextItemNo = useMemo(() => generateNextItemNo(supplies), [supplies]);
    const usedColors = useMemo(() => new Set(supplies.map((supply) => supply.tubeColor?.toLowerCase()).filter(Boolean)), [supplies]);

    const resetForm = () => {
        setAddError(null);
        setForm({
            name: '',
            category: '',
            color: getNextAvailableColor(supplies),
            currentStock: '',
            minStock: '',
            maxStock: '',
        });
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

        if (!nextName || !form.category.trim()) {
            setAddError('Name and category are required.');
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
                category: form.category.trim(),
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
            await updateSupply(selectedSupply.id, {
                ...selectedSupply,
                currentStock: selectedSupply.currentStock + quantity,
                stockQuantity: selectedSupply.currentStock + quantity,
                lastRestocked: new Date().toISOString().slice(0, 10),
            });
            setShowRefillModal(false);
            resetRefillForm();
            await fetchSupplies(false);
        } catch (err: unknown) {
            setRefillError(err instanceof Error ? err.message : 'Failed to refill inventory item.');
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
                            <input
                                type="text"
                                placeholder="Item name"
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                required
                            />
                            <input
                                type="text"
                                placeholder="Category"
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={form.category}
                                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                                list="supply-categories"
                                required
                            />
                            <datalist id="supply-categories">
                                {categories.filter((category) => category !== 'All Categories').map((category) => (
                                    <option key={category} value={category} />
                                ))}
                            </datalist>
                            <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                                <input
                                    type="color"
                                    className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                                    value={form.color}
                                    onChange={(e) => handleColorChange(e.target.value)}
                                    aria-label="Item color"
                                />
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Item Color</p>
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
                    <select className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Supply Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.length === 0 ? (
                    <div className="col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12 text-center text-slate-400">No supplies found.</div>
                ) : filtered.map((supply) => {
                    const status = getStockStatus(supply.currentStock, supply.minStock);
                    const pct = Math.min(100, Math.round((supply.currentStock / supply.maxStock) * 100));
                    return (
                        <div key={supply.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    {supply.tubeColor && <div className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: supply.tubeColor }} />}
                                    <div>
                                        <p className="font-semibold text-slate-700">{supply.name}</p>
                                        <p className="text-xs text-slate-400">{supply.itemNo ? `${supply.itemNo} - ` : ''}{supply.category}</p>
                                    </div>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${status.color}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{status.label}
                                </span>
                            </div>

                            {/* Stock Bar */}
                            <div className="mb-3">
                                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                    <span>{supply.currentStock} / {supply.maxStock} {supply.unit}</span>
                                    <span>{pct}%</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${pct < 20 ? 'bg-red-500' : pct < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>Min: {supply.minStock}</span>
                                <span>Last restocked: {supply.lastRestocked}</span>
                            </div>

                            {supply.currentStock < supply.minStock && (
                                <div className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 text-xs font-bold rounded-xl border border-amber-200">
                                    <span className="material-icons text-sm">shopping_cart</span>Reorder
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
