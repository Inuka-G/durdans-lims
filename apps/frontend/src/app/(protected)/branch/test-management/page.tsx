"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import CreateTestModal from "@/components/branch/CreateTestModal";
import EditTestModal from "@/components/branch/EditTestModal";
import { useAuth } from "@/hooks/useAuth";
import { getBranchTests, createBranchTest, patchBranchTest, BranchTest, getBranches, getBranchesPage } from "@/lib/api";

const DEFAULT_BRANCH_ID = "b6030d28-10ef-4165-9554-8887fabfddb8";

export default function BranchTestManagementPage() {
    const { branchCode } = useAuth();
    const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedTest, setSelectedTest] = useState<BranchTest | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All Categories");
    const [selectedStatusFilter, setSelectedStatusFilter] = useState("All Status");

    const [tests, setTests] = useState<BranchTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [branchName, setBranchName] = useState("Loading...");

    const fetchTests = async () => {
        if (!activeBranchId) return;
        setLoading(true);
        try {
            const data = await getBranchTests(activeBranchId);
            setTests(data);
        } catch (error) {
            console.error("Failed to fetch tests", error);
            toast.error("Failed to load tests.");
        } finally {
            setLoading(false);
        }
    };
    
    const resolveBranch = async () => {
        try {
            const data = await getBranches();
            const targetCode = branchCode || DEFAULT_BRANCH_ID;
            const branch = data.find((b) => b.id === targetCode || b.code.toUpperCase() === targetCode.toUpperCase());
            if (branch) {
                setBranchName(branch.name);
                setActiveBranchId(branch.id);
            } else {
                setBranchName(targetCode);
                setActiveBranchId(targetCode); // It might fail later if backend expects UUID, but this is best effort
            }
        } catch (error) {
            console.error("Failed to fetch branch details", error);
            const targetCode = branchCode || DEFAULT_BRANCH_ID;
            setBranchName(targetCode);
            setActiveBranchId(targetCode);
        }
    };

    useEffect(() => {
        resolveBranch();
    }, [branchCode]);

    useEffect(() => {
        if (activeBranchId) {
            fetchTests();
        }
    }, [activeBranchId]);

    const filteredTests = tests.filter(test => {
        const query = searchQuery.toLowerCase();
        const matchesQuery = test.testName.toLowerCase().includes(query) ||
            (test.testCode && test.testCode.toLowerCase().includes(query)) ||
            (test.id && String(test.id).toLowerCase().includes(query));

        const matchesCategory = selectedCategoryFilter === "All Categories" || test.category === selectedCategoryFilter;

        const matchesStatus = selectedStatusFilter === "All Status" ||
            (selectedStatusFilter === "Active" && test.isActive) ||
            (selectedStatusFilter === "Inactive" && !test.isActive);

        return matchesQuery && matchesCategory && matchesStatus;
    });

    const handleCreateTest = async (testData: BranchTest) => {
        try {
            await createBranchTest(activeBranchId!, testData);
            toast.success("Test created successfully!");
            fetchTests(); // Refresh the list
        } catch (error) {
            console.error("Failed to create test", error);
            toast.error("Failed to create test.");
        }
    };

    const handleEditTest = async (testData: Partial<BranchTest>) => {
        if (!selectedTest?.id) return;
        try {
            await patchBranchTest(activeBranchId!, selectedTest.id, testData);
            toast.success("Test updated successfully!");
            fetchTests(); // Refresh the list
        } catch (error) {
            console.error("Failed to update test", error);
            toast.error("Failed to update test.");
        }
    };

    const handleToggleStatus = async (test: BranchTest) => {
        if (!test.id) return;
        const newStatus = !test.isActive;
        try {
            await patchBranchTest(activeBranchId!, test.id, { isActive: newStatus });
            toast.success(`Test ${newStatus ? 'activated' : 'deactivated'} successfully!`);
            fetchTests(); // Refresh the list
        } catch (error) {
            console.error("Failed to toggle status", error);
            toast.error("Failed to change test status.");
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount);
    };

    return (
        <div className="w-full bg-[#f8fafc] min-h-[calc(100vh-76px)] p-8 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">Test Management – {branchName}</h1>
                    <p className="text-[13px] font-medium text-[#64748b] mt-1">Manage and monitor laboratory tests and pricing.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-[#1277E1] hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm active:scale-95"
                >
                    <span className="material-icons text-[18px]">add_circle</span>
                    Create New Test
                </button>
            </div>

            {/* Controls Bar */}
            <div className="bg-white border text-sm border-[#ecf0f6] shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">

                {/* Search */}
                <div className="relative flex-1 max-w-[600px]">
                    <span className="material-icons text-[18px] absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]">search</span>
                    <input
                        type="text"
                        placeholder="Search by test name, code or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-[#f8fafc] border border-[#ecf0f6] text-[#0f172a] font-semibold py-2.5 pl-11 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all w-full placeholder:text-[#94a3b8] placeholder:font-medium text-[13px]"
                    />
                </div>

                <div className="flex items-center gap-3">
                    {/* Category Filter */}
                    <div className="relative w-[180px]">
                        <select
                            value={selectedCategoryFilter}
                            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            className="w-full appearance-none bg-white border border-[#ecf0f6] text-[#475569] font-bold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all cursor-pointer text-[13px]"
                        >
                            <option value="All Categories">All Categories</option>
                            <option value="Hematology">Hematology</option>
                            <option value="Biochemistry">Biochemistry</option>
                            <option value="Microbiology">Microbiology</option>
                            <option value="Serology">Serology</option>
                            <option value="Pathology">Pathology</option>
                        </select>
                        <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none text-lg">expand_more</span>
                    </div>

                    {/* Status Filter */}
                    <div className="relative w-[140px]">
                        <select
                            value={selectedStatusFilter}
                            onChange={(e) => setSelectedStatusFilter(e.target.value)}
                            className="w-full appearance-none bg-white border border-[#ecf0f6] text-[#475569] font-bold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1277E1]/20 focus:border-[#1277E1] transition-all cursor-pointer text-[13px]"
                        >
                            <option value="All Status">All Status</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                        <span className="material-icons absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none text-lg">expand_more</span>
                    </div>
                </div>
            </div>

            {/* Data Table Container */}
            <div className="bg-white border border-[#ecf0f6] shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] rounded-2xl overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="border-b border-[#ecf0f6] bg-[#f8fafc]">
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[15%]">Test Code / ID</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[30%]">Test Name</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[15%]">Category</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[10%]">Price</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest w-[10%]">TAT / Unit</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest text-center w-[10%]">Status</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-[#94a3b8] uppercase tracking-widest text-right w-[10%]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f8fafc]">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center">
                                        <span className="material-icons animate-spin text-[#1277E1] text-3xl">sync</span>
                                    </td>
                                </tr>
                            ) : filteredTests.length > 0 ? (
                                filteredTests.map((test) => (
                                    <tr key={test.id} className="hover:bg-[#f8fafc]/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-bold text-[#0f172a]">{test.testCode || `TST-0${test.id}`}</span>
                                                <span className="text-[11px] font-medium text-[#94a3b8]">ID: {test.id}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-[14px] font-extrabold text-[#0f172a]">{test.testName}</span>
                                                {test.referenceRange && (
                                                    <span className="text-[11px] font-medium text-[#64748b] mt-0.5">
                                                        Ref: {test.referenceRange}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f1f5f9] text-[#64748b]">
                                                {test.category}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-bold text-[#1277E1]">{formatCurrency(test.price)}</span>
                                                {test.unit && (
                                                    <span className="text-[10px] font-medium text-[#94a3b8] mt-0.5">
                                                        {test.unit}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-[13px] font-medium text-[#64748b]">
                                                {test.turnaroundTime || test.unit || "N/A"}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f8fafc] border ${test.isActive
                                                ? 'border-[#86efac]/30'
                                                : 'border-[#fca5a5]/30'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${test.isActive ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}></div>
                                                <span className={`text-[10px] font-extrabold uppercase tracking-widest ${test.isActive ? 'text-[#16a34a]' : 'text-[#dc2626]'
                                                    }`}>
                                                    {test.isActive ? 'ACTIVE' : 'INACTIVE'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2 text-[#94a3b8]">
                                                <button
                                                    onClick={() => {
                                                        setSelectedTest(test);
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="hover:text-[#1277E1] transition-colors p-1"
                                                    title="Edit Test"
                                                >
                                                    <span className="material-icons text-[18px]">edit</span>
                                                </button>
                                                {test.isActive ? (
                                                    <button
                                                        onClick={() => handleToggleStatus(test)}
                                                        className="hover:text-[#ef4444] transition-colors p-1"
                                                        title="Deactivate Test"
                                                    >
                                                        <span className="material-icons text-[18px]">block</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleToggleStatus(test)}
                                                        className="text-[#1277E1] hover:text-[#1e40af] bg-blue-50 rounded p-1 transition-colors"
                                                        title="Activate Test"
                                                    >
                                                        <span className="material-icons text-[18px]">check_circle</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-[#64748b] font-medium text-[13px]">
                                        No tests found matching "{searchQuery}"
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-[#ecf0f6] flex items-center justify-between text-[13px]">
                    <span className="text-[#64748b] font-medium">Showing {filteredTests.length > 0 ? 1 : 0} to {filteredTests.length} of {tests.length} results</span>
                    <div className="flex items-center gap-1 font-bold">
                        <button className="px-3 py-1.5 text-[#94a3b8] hover:text-[#0f172a] transition-colors disabled:opacity-50" disabled>Previous</button>
                        <button className="w-8 h-8 flex items-center justify-center bg-[#1277E1] text-white rounded-lg shadow-sm">1</button>
                        <button className="w-8 h-8 flex items-center justify-center text-[#475569] hover:bg-[#f8fafc] rounded-lg transition-colors">2</button>
                        <button className="w-8 h-8 flex items-center justify-center text-[#475569] hover:bg-[#f8fafc] rounded-lg transition-colors">3</button>
                        <button className="px-3 py-1.5 text-[#475569] hover:text-[#0f172a] transition-colors">Next</button>
                    </div>
                </div>
            </div>

            {/* Create Modal */}
            <CreateTestModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSave={handleCreateTest}
            />

            {/* Edit Modal */}
            <EditTestModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSelectedTest(null);
                }}
                onSave={handleEditTest}
                test={selectedTest}
            />

        </div>
    );
}
