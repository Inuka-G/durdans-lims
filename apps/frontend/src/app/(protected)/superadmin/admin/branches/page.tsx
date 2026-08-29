"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import BranchDetailsPanel from "@/components/admin/BranchDetailsPanel";
import BranchCreateModal from "@/components/admin/BranchCreateModal";
import BranchEditModal from "@/components/admin/BranchEditModal";
import AssignAdminModal from "@/components/admin/AssignAdminModal";
import { getBranches, createBranch, updateBranch, BranchResponse } from "@/lib/api";

export type Branch = BranchResponse;

export default function BranchManagementPage() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBranch, setSelectedBranch] = useState<string | number | null>(null);
    const [selectedBranchForModal, setSelectedBranchForModal] = useState<Branch | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAssignAdminModalOpen, setIsAssignAdminModalOpen] = useState(false);

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const data = await getBranches(0, 100); // Fetch up to 100 branches for simplicity
            setBranches(data.content);
        } catch (error) {
            console.error("Failed to fetch branches", error);
            toast.error("Failed to load branches from the server.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    const handleCreateBranch = async (branchData: Partial<Branch>) => {
        try {
            if (!branchData.code || !branchData.name) throw new Error("Missing required fields");
            await createBranch({ 
                code: branchData.code, 
                name: branchData.name,
                location: branchData.location,
                contactEmail: branchData.contactEmail,
                contactPhone: branchData.contactPhone,
                status: branchData.status
            });
            toast.success("Branch created successfully!");
            await fetchBranches();
        } catch (error: any) {
            console.error("Failed to create branch", error);
            toast.error(error?.response?.data?.message || error.message || "Failed to create new branch.");
            throw error;
        }
    };

    const handleUpdateBranch = async (id: string, branchData: Partial<Branch>) => {
        try {
            if (!branchData.name) throw new Error("Missing name");
            await updateBranch(id, { 
                name: branchData.name,
                location: branchData.location,
                contactEmail: branchData.contactEmail,
                contactPhone: branchData.contactPhone,
                status: branchData.status
            });
            toast.success("Branch updated successfully!");
            await fetchBranches();
        } catch (error: any) {
            console.error("Failed to update branch", error);
            toast.error(error?.response?.data?.message || error.message || "Failed to update branch.");
            throw error;
        }
    };

    const activeBranchData = branches.find(b => String(b.id) === String(selectedBranch));

    return (
        <div className="max-w-[1400px] mx-auto w-full font-sans text-slate-900 min-h-[calc(100vh-136px)] pt-2 pb-10 flex flex-col relative">

            <div className="mb-8">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Branch Management</h1>
                <p className="text-sm font-medium text-slate-500 mt-1 pb-4">Manage hospital branches, view health scores, and configure settings.</p>
            </div>

            {/* List to trigger panel */}
            <div className="bg-white border text-sm border-slate-200 shadow-sm rounded-2xl flex-1 flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="font-bold text-slate-800">Active Branches</h2>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition-colors shadow-sm text-sm flex items-center gap-1.5"
                    >
                        <span className="material-icons text-[18px]">add</span>
                        Add New Branch
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[710px] table-fixed text-left text-sm">
                        <caption className="sr-only">Hospital branches</caption>
                        <thead>
                            <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                <th scope="col" className="w-36 py-2 pl-4 pr-3 font-semibold">
                                    Branch ID
                                </th>
                                <th scope="col" className="px-3 py-2 font-semibold">
                                    Branch
                                </th>
                                <th scope="col" className="w-40 px-3 py-2 font-semibold">
                                    Location
                                </th>
                                <th scope="col" className="w-28 px-3 py-2 font-semibold">
                                    Status
                                </th>
                                <th scope="col" className="w-32 py-2 pl-3 pr-4 text-right font-semibold">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center">
                                        <span className="material-icons animate-spin text-blue-600 text-3xl">sync</span>
                                    </td>
                                </tr>
                            ) : branches.length > 0 ? (
                                branches.map((branch) => (
                                    <tr key={branch.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <span className="text-[13px] font-extrabold text-slate-800">{branch.code}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-[14px] font-bold text-slate-900">{branch.name}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-[13px] font-medium text-slate-500">{branch.location || "N/A"}</span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold ${branch.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {branch.status || "Active"}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedBranchForModal(branch);
                                                        setIsEditModalOpen(true);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-lg transition-colors flex items-center justify-center"
                                                    title="Edit Branch"
                                                >
                                                    <span className="material-icons text-[16px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => setSelectedBranch(branch.id)}
                                                    className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    View Details
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-500 font-medium text-[13px]">
                                        No branches found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Slide-out Panel Overlay */}
            {selectedBranch && (
                <div
                    className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 transition-opacity"
                    onClick={() => setSelectedBranch(null)}
                />
            )}

            {/* Slide-out Panel Content */}
            <div className={`fixed top-0 right-0 h-screen w-full max-w-[440px] bg-white shadow-2xl border-l border-slate-200 z-50 transform transition-transform duration-300 ease-in-out ${selectedBranch ? 'translate-x-0' : 'translate-x-full'}`}>
                {selectedBranch && (
                    <BranchDetailsPanel
                        branch={activeBranchData}
                        onClose={() => setSelectedBranch(null)}
                        onEditClick={() => {
                            setSelectedBranchForModal(activeBranchData || null);
                            setIsEditModalOpen(true);
                        }}
                        onChangeAdminClick={() => {
                            setSelectedBranchForModal(activeBranchData || null);
                            setIsAssignAdminModalOpen(true);
                        }}
                    />
                )}
            </div>

            {/* Create Branch Modal */}
            <BranchCreateModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSave={handleCreateBranch}
            />

            {/* Edit Branch Modal */}
            <BranchEditModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSelectedBranchForModal(null);
                }}
                branchData={selectedBranchForModal}
                onSave={handleUpdateBranch}
            />

            {/* Assign Admin Modal */}
            <AssignAdminModal
                isOpen={isAssignAdminModalOpen}
                onClose={() => {
                    setIsAssignAdminModalOpen(false);
                    setSelectedBranchForModal(null);
                }}
                branchName={activeBranchData?.name || selectedBranchForModal?.name}
            />

        </div>
    );
}
