"use client";

import { useState } from "react";
import DemoDataBanner from "@/components/shared/DemoDataBanner";
import BranchDetailsPanel from "@/components/admin/BranchDetailsPanel";
import BranchCreateModal from "@/components/admin/BranchCreateModal";
import BranchEditModal from "@/components/admin/BranchEditModal";
import AssignAdminModal from "@/components/admin/AssignAdminModal";

// Mock Data for the list
const mockBranches = [
    { id: "BR-COL-001", name: "Colombo Main Branch", location: "Colombo 07", status: "Active" },
    { id: "BR-KAN-002", name: "Kandy Regional Center", location: "Kandy", status: "Active" },
    { id: "BR-GAL-003", name: "Galle Southern Hub", location: "Galle", status: "Active" },
];

export default function BranchManagementPage() {
    const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAssignAdminModalOpen, setIsAssignAdminModalOpen] = useState(false);

    const activeBranchData = mockBranches.find(b => b.id === selectedBranch);

    return (
        <div className="max-w-[1400px] mx-auto w-full font-sans text-slate-900 min-h-[calc(100vh-136px)] pt-2 pb-10 flex flex-col relative">
            <DemoDataBanner note="Demo data — the branch list and create/edit actions are placeholders not yet wired to a backend." />

            <div className="mb-8">

                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Branch Management</h1>
                <p className="text-sm font-medium text-slate-500 mt-1 pb-4">Manage hospital branches, view health scores, and configure settings.</p>
            </div>

            {/* Dummy List to trigger panel */}
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
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Branch ID</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Branch Name</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Location</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Status</th>
                                <th className="py-4 px-6 text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {mockBranches.map((branch) => (
                                <tr key={branch.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="py-4 px-6">
                                        <span className="text-[13px] font-extrabold text-slate-800">{branch.id}</span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="text-[14px] font-bold text-slate-900">{branch.name}</span>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="text-[13px] font-medium text-slate-500">{branch.location}</span>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-600">
                                            {branch.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <button
                                            onClick={() => setSelectedBranch(branch.id)}
                                            className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
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
                        onClose={() => setSelectedBranch(null)}
                        onEditClick={() => setIsEditModalOpen(true)}
                        onChangeAdminClick={() => setIsAssignAdminModalOpen(true)}
                    />
                )}
            </div>

            {/* Create Branch Modal */}
            <BranchCreateModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />

            {/* Edit Branch Modal */}
            <BranchEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                branchData={activeBranchData}
            />

            {/* Assign Admin Modal */}
            <AssignAdminModal
                isOpen={isAssignAdminModalOpen}
                onClose={() => setIsAssignAdminModalOpen(false)}
                branchName={activeBranchData?.name}
            />

        </div>
    );
}
