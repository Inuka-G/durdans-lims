"use client";

import { useEffect, useMemo, useState } from "react";
import { getLabTests } from "@/lib/api";

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

export default function MasterDataPage() {
    const [activeTab, setActiveTab] = useState("tests");
    const [tests, setTests] = useState<TestRecord[]>([]);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All Categories");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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
                if (active) setError("Could not load the lab test catalog.");
            } finally {
                if (active) setLoading(false);
            }
        };

        void loadTests();

        return () => {
            active = false;
        };
    }, []);

    const categories = useMemo(
        () => ["All Categories", ...Array.from(new Set(tests.map((test) => test.category))).sort()],
        [tests]
    );

    const filteredTests = useMemo(() => {
        const query = search.trim().toLowerCase();

        return tests.filter((test) => {
            const matchesSearch =
                !query ||
                test.code.toLowerCase().includes(query) ||
                test.name.toLowerCase().includes(query);
            const matchesCategory = categoryFilter === "All Categories" || test.category === categoryFilter;

            return matchesSearch && matchesCategory;
        });
    }, [categoryFilter, search, tests]);

    const activeTests = tests.filter((test) => test.isActive).length;

    const getCategoryStyles = (category: TestCategory) => {
        switch (category) {
            case "Haematology": return "bg-blue-100 text-blue-600";
            case "Biochemistry": return "bg-purple-100 text-purple-600";
            case "Immunology": return "bg-orange-100 text-orange-600";
            default: return "bg-slate-100 text-slate-600";
        }
    };

    const formatPrice = (price: number) => {
        return price.toLocaleString("en-LK", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    return (
        <div className="max-w-[1400px] mx-auto w-full font-sans text-slate-900 min-h-[calc(100vh-136px)] pt-2 pb-10 flex flex-col">

            {/* Breadcrumb & Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-3">
                    <span className="hover:text-slate-800 cursor-pointer transition-colors">Home</span>
                    <span className="text-[10px] opacity-50">/</span>
                    <span className="hover:text-slate-800 cursor-pointer transition-colors">System Admin</span>
                    <span className="text-[10px] opacity-50">/</span>
                    <span className="text-slate-800 font-bold">Master Data Management</span>
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Master Data Management</h1>
                <p className="text-sm font-medium text-slate-500 mt-1.5 pb-5">Define and manage laboratory test catalogs, pricing, and reference ranges.</p>

                {/* Tabs */}
                <div className="flex items-center gap-8 border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab("tests")}
                        className={`pb-3.5 text-sm font-bold transition-all border-b-[3px] px-1 ${activeTab === "tests"
                            ? "text-blue-600 border-blue-600"
                            : "text-slate-500 border-transparent hover:text-slate-800"
                            }`}
                    >
                        Test Master Data
                    </button>
                    <button
                        onClick={() => setActiveTab("categories")}
                        className={`pb-3.5 text-sm font-bold transition-all border-b-[3px] px-1 ${activeTab === "categories"
                            ? "text-blue-600 border-blue-600"
                            : "text-slate-500 border-transparent hover:text-slate-800"
                            }`}
                    >
                        Test Categories
                    </button>
                    <button
                        onClick={() => setActiveTab("pricing")}
                        className={`pb-3.5 text-sm font-bold transition-all border-b-[3px] px-1 ${activeTab === "pricing"
                            ? "text-blue-600 border-blue-600"
                            : "text-slate-500 border-transparent hover:text-slate-800"
                            }`}
                    >
                        Pricing Configuration
                    </button>
                    <button
                        onClick={() => setActiveTab("ranges")}
                        className={`pb-3.5 text-sm font-bold transition-all border-b-[3px] px-1 ${activeTab === "ranges"
                            ? "text-blue-600 border-blue-600"
                            : "text-slate-500 border-transparent hover:text-slate-800"
                            }`}
                    >
                        Reference Ranges
                    </button>
                </div>
            </div>

            {/* Container for Controls and Table */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl flex-1 flex flex-col mb-4 overflow-hidden">

                {/* Controls Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 border-b border-slate-100">
                    <div className="flex items-center gap-4 flex-1">
                        {/* Search */}
                        <div className="relative flex-1 max-w-[400px]">
                            <span className="material-icons text-sm absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search by Test Code or Name..."
                                className="bg-white border border-slate-200 text-slate-800 font-semibold py-2 pl-10 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full placeholder:text-slate-400 placeholder:font-medium text-sm"
                            />
                        </div>

                        {/* Category Filter */}
                        <div className="relative w-[180px]">
                            <select
                                value={categoryFilter}
                                onChange={(event) => setCategoryFilter(event.target.value)}
                                className="w-full appearance-none bg-white border border-slate-200 text-slate-700 font-semibold py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer text-sm"
                            >
                                {categories.map((category) => (
                                    <option key={category}>{category}</option>
                                ))}
                            </select>
                            <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            disabled
                            title="Bulk upload needs the master-data write API."
                            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-400 px-4 py-2 rounded-xl font-bold transition-colors text-sm shadow-sm cursor-not-allowed"
                        >
                            <span className="material-icons text-[18px]">file_upload</span>
                            Bulk Upload
                        </button>
                        <button
                            disabled
                            title="Adding tests needs the master-data write API."
                            className="flex items-center justify-center gap-2 bg-slate-300 text-white px-4 py-2 rounded-xl font-bold transition-colors shadow-sm cursor-not-allowed text-sm"
                        >
                            <span className="material-icons text-[18px]">add</span>
                            Add New Test
                        </button>
                    </div>
                </div>

                {/* Data Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/30">
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[15%]">Test Code</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[25%]">Test Name</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[20%] text-center">Category</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[15%] text-right">Default Price (LKR)</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[15%] text-center">Specimen</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest w-[10%] text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-sm font-semibold text-slate-400">
                                        Loading test catalog...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-sm font-semibold text-red-500">
                                        {error}
                                    </td>
                                </tr>
                            ) : filteredTests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-sm font-semibold text-slate-400">
                                        No tests match your filters.
                                    </td>
                                </tr>
                            ) : filteredTests.map((test) => (
                                <tr key={test.code} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="py-5 px-6">
                                        <span className="text-[13px] font-extrabold text-slate-800">{test.code}</span>
                                    </td>
                                    <td className="py-5 px-6">
                                        <span className="text-[14px] font-bold text-slate-900">{test.name}</span>
                                        <p className="mt-1 text-[11px] font-semibold text-slate-400">
                                            TAT {test.turnAroundTimeHours ?? "-"}h
                                        </p>
                                    </td>
                                    <td className="py-5 px-6 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold ${getCategoryStyles(test.category)}`}>
                                            {test.category}
                                        </span>
                                    </td>
                                    <td className="py-5 px-6 text-right">
                                        <span className="text-[14px] font-semibold text-slate-800">{formatPrice(test.price)}</span>
                                    </td>
                                    <td className="py-5 px-6 text-center">
                                        <span className="text-[12px] font-semibold text-slate-700">
                                            {test.sampleType ?? "-"}
                                        </span>
                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                            {test.tubeType ?? "-"}
                                        </p>
                                    </td>
                                    <td className="py-5 px-6 text-center">
                                        <span className="inline-flex items-center rounded-md bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                                            Active
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Custom Footer */}
            <div className="mt-4 pt-4 flex flex-col sm:flex-row justify-between items-center text-xs font-semibold text-slate-400 gap-4 px-2">
                <div className="flex items-center gap-2.5">
                    <span>&copy; 2023 Durdans Hospital. Version 2.4.1</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="flex items-center gap-1.5">
                        Active Tests: <span className="text-emerald-500 font-bold">{activeTests}</span>
                    </span>
                </div>
                <div className="flex items-center justify-end gap-3 flex-1">
                    <button className="bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 px-4 py-2 rounded-lg transition-all font-bold shadow-sm">
                        Documentation
                    </button>
                    <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg transition-colors font-bold shadow-sm">
                        Feedback
                    </button>
                </div>
            </div>

        </div>
    );
}
