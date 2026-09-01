"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Database, FlaskConical, Layers, Plus, RefreshCw, Search, Upload, X } from "lucide-react";
const getLabTests = async (): Promise<any[]> => {
    return [
        { id: "1", code: "CBC", name: "Complete Blood Count", category: "Haematology", price: 1500, sampleType: "Blood", tubeType: "EDTA", turnAroundTimeHours: 24, isActive: true }
    ];
};
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import SegmentedControl from "@/components/ui/SegmentedControl";
import StatusChip from "@/components/ui/StatusChip";
import EmptyState from "@/components/ui/EmptyState";
import KpiTile from "@/components/ui/KpiTile";
import { InputField, SelectField } from "@/components/ui/Field";

type TestCategory = string;

interface TestRecord {
    id: string;
    code: string;
    name: string;
    category: TestCategory;
    price: number;
    sampleType?: string;
    tubeType?: string;
    turnAroundTimeHours?: number;
    isActive: boolean;
}

type MasterTab = "tests" | "categories" | "pricing" | "ranges";

const TAB_OPTIONS: { value: MasterTab; label: string }[] = [
    { value: "tests", label: "Tests" },
    { value: "categories", label: "Categories" },
    { value: "pricing", label: "Pricing" },
    { value: "ranges", label: "Reference ranges" },
];

const ALL_CATEGORIES = "All Categories";
const SKELETON_ROWS = 8;

export default function MasterDataPage() {
    const [activeTab, setActiveTab] = useState<MasterTab>("tests");
    const [tests, setTests] = useState<TestRecord[]>([]);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let active = true;

        const loadTests = async () => {
            try {
                setLoading(true);
                setError("");
                const rows = await getLabTests();
                if (!active) return;

                setTests(rows.map((test: any) => ({
                    id: String(test.id ?? test.testId ?? test.testCode),
                    code: String(test.testCode ?? test.code ?? ""),
                    name: String(test.testName ?? test.name ?? ""),
                    category: String(test.category ?? "General"),
                    price: Number(test.price ?? 0),
                    sampleType: test.sampleType,
                    tubeType: test.tubeType,
                    turnAroundTimeHours: test.turnAroundTimeHours,
                    isActive: true,
                })));
            } catch (loadError) {
                console.error("Failed to load test master data", loadError);
                if (active) setError("Couldn't load the lab test catalog. Check your connection and retry.");
            } finally {
                if (active) setLoading(false);
            }
        };

        void loadTests();

        return () => {
            active = false;
        };
    }, [reloadKey]);

    const retry = useCallback(() => setReloadKey((k) => k + 1), []);

    const categories = useMemo(
        () => [ALL_CATEGORIES, ...Array.from(new Set(tests.map((test) => test.category))).sort()],
        [tests]
    );

    const filteredTests = useMemo(() => {
        const query = search.trim().toLowerCase();

        return tests.filter((test) => {
            const matchesSearch =
                !query ||
                test.code.toLowerCase().includes(query) ||
                test.name.toLowerCase().includes(query);
            const matchesCategory = categoryFilter === ALL_CATEGORIES || test.category === categoryFilter;

            return matchesSearch && matchesCategory;
        });
    }, [categoryFilter, search, tests]);

    const categoryCount = categories.length - 1;
    const hasFilters = Boolean(search.trim()) || categoryFilter !== ALL_CATEGORIES;

    const clearFilters = () => {
        setSearch("");
        setCategoryFilter(ALL_CATEGORIES);
    };

    const formatPrice = (price: number) => {
        return price.toLocaleString("en-LK", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    return (
        <div className="mx-auto w-full max-w-[1400px]">
            <PageHeader
                title="Master data"
                crumbs={[{ label: "Super admin", href: "/superadmin" }, { label: "Master data" }]}
                meta={
                    <>
                        <Database className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Test catalog, pricing and reference ranges</span>
                        {!loading && !error && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {tests.length.toLocaleString()} {tests.length === 1 ? "test" : "tests"}
                                </span>
                            </>
                        )}
                    </>
                }
                actions={
                    <>
                        {/* Wrapping spans keep the tooltip reachable while the buttons are disabled. */}
                        <span title="Bulk upload needs the master-data write API." className="inline-flex">
                            <Button icon={Upload} disabled aria-describedby="master-data-write-note">
                                Bulk upload
                            </Button>
                        </span>
                        <span title="Adding tests needs the master-data write API." className="inline-flex">
                            <Button variant="primary" icon={Plus} disabled aria-describedby="master-data-write-note">
                                Add test
                            </Button>
                        </span>
                        <span id="master-data-write-note" className="sr-only">
                            Unavailable until the master-data write API is connected.
                        </span>
                    </>
                }
            />

            {/* Screen-reader status for the load lifecycle only — filter counts live in the
                visible table footer, so they must not re-announce on every keystroke. */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading ? "Loading test catalog" : error ? "Test catalog failed to load" : "Test catalog loaded"}
            </p>

            {/* Summary */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <KpiTile label="Tests in catalog" value={tests.length} icon={FlaskConical} loading={loading} note="All lab tests" />
                <KpiTile label="Categories" value={categoryCount} icon={Layers} loading={loading} note="Distinct test groups" />
            </div>

            {/* Section tabs */}
            <div className="mb-3">
                <SegmentedControl
                    ariaLabel="Master data section"
                    value={activeTab}
                    onChange={setActiveTab}
                    options={TAB_OPTIONS}
                />
            </div>

            <SectionCard title="Test catalog" count={!loading && !error ? filteredTests.length : undefined} flush>
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <InputField
                        label="Search tests"
                        hideLabel
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by test code or name"
                        autoComplete="off"
                        className="min-w-[200px] flex-1 sm:max-w-sm"
                    />
                    <SelectField
                        label="Category"
                        hideLabel
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value)}
                        className="w-full sm:w-48"
                    >
                        {categories.map((category) => (
                            <option key={category} value={category}>
                                {category === ALL_CATEGORIES ? "All categories" : category}
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
                            <li key={i} className="flex items-center gap-3 px-4 py-3">
                                <span className="h-3 w-20 shrink-0 rounded bg-skeleton" />
                                <span className="h-4 w-40 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-4 w-24 rounded bg-skeleton md:block" />
                                <span className="ml-auto h-3 w-16 rounded bg-skeleton" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton lg:block" />
                                <span className="h-4 w-14 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : error ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Test catalog unavailable"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={retry}>
                                Retry
                            </Button>
                        }
                    />
                ) : filteredTests.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={Search}
                            title="No tests match"
                            description="Try a different test code, name or category."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={FlaskConical}
                            title="No tests in the catalog yet"
                            description="Lab tests added to the master data will be listed here."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        {/* table-fixed budget: fixed cols are 544px (Code 128 + Category 160 + Price 144
                            + Status 112), rising to 720px at lg when Specimen (176) appears. The min-w
                            per band keeps the auto-width Test column at >= 160px in both cases. */}
                        <table className="w-full min-w-[760px] table-fixed text-left text-sm lg:min-w-[890px]">
                            <caption className="sr-only">Lab test catalog</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-32 py-2 pl-4 pr-3 font-semibold">
                                        Code
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-semibold">
                                        Test
                                    </th>
                                    <th scope="col" className="w-40 px-3 py-2 font-semibold">
                                        Category
                                    </th>
                                    <th scope="col" className="w-36 px-3 py-2 text-right font-semibold">
                                        Price (LKR)
                                    </th>
                                    <th scope="col" className="hidden w-44 px-3 py-2 font-semibold lg:table-cell">
                                        Specimen
                                    </th>
                                    <th scope="col" className="w-28 py-2 pl-3 pr-4 font-semibold">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {filteredTests.map((test) => (
                                    <tr key={test.code} className="transition-colors hover:bg-surface-hover">
                                        <td className="py-2 pl-4 pr-3 font-mono text-xs font-medium text-fg">{test.code}</td>
                                        <td className="px-3 py-2">
                                            <p className="truncate font-medium text-fg" title={test.name}>
                                                {test.name}
                                            </p>
                                            <p className="mt-0.5 text-xs text-fg-muted">
                                                TAT {test.turnAroundTimeHours ?? "—"} h
                                            </p>
                                        </td>
                                        <td className="px-3 py-2">
                                            <StatusChip tone="neutral" size="sm" title={test.category}>
                                                {test.category}
                                            </StatusChip>
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-fg">{formatPrice(test.price)}</td>
                                        <td className="hidden px-3 py-2 lg:table-cell">
                                            <p className="truncate text-fg-secondary" title={test.sampleType}>
                                                {test.sampleType ?? "—"}
                                            </p>
                                            <p className="mt-0.5 truncate text-xs text-fg-muted" title={test.tubeType}>
                                                {test.tubeType ?? "—"}
                                            </p>
                                        </td>
                                        <td className="py-2 pl-3 pr-4">
                                            {test.isActive ? (
                                                <StatusChip tone="success" dot size="sm">
                                                    Active
                                                </StatusChip>
                                            ) : (
                                                <StatusChip tone="neutral" dot size="sm">
                                                    Inactive
                                                </StatusChip>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer: result count */}
                {!loading && !error && tests.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-edge px-4 py-2 text-xs text-fg-muted">
                        <span className="tabular-nums">
                            Showing {filteredTests.length.toLocaleString()} of {tests.length.toLocaleString()}{" "}
                            {tests.length === 1 ? "test" : "tests"}
                        </span>
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
