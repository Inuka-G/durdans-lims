"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import StatusChip, { humanizeStatus, toneForStatus } from "@/components/ui/StatusChip";
import DemoDataBanner from "@/components/shared/DemoDataBanner";
import BranchDetailsPanel from "@/components/admin/BranchDetailsPanel";
import BranchCreateModal from "@/components/admin/BranchCreateModal";
import BranchEditModal from "@/components/admin/BranchEditModal";
import AssignAdminModal from "@/components/admin/AssignAdminModal";

// Same selector Modal.tsx traps against, so the drawer behaves like the dialog it claims to be.
const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

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

    const panelRef = useRef<HTMLDivElement | null>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    const modalOpenRef = useRef(false);

    const activeBranchData = mockBranches.find(b => b.id === selectedBranch);
    const panelOpen = Boolean(selectedBranch);

    // Keep a ref of "any modal open" so the drawer's Esc handler can defer to
    // the Modal primitive without re-running the focus effect below.
    useEffect(() => {
        modalOpenRef.current = isCreateModalOpen || isEditModalOpen || isAssignAdminModalOpen;
    }, [isCreateModalOpen, isEditModalOpen, isAssignAdminModalOpen]);

    // Drawer a11y: move focus into the panel on open, trap Tab inside it, lock body
    // scroll, Esc closes it (unless a modal launched from the panel is open), and
    // focus returns to the opener. Matches Modal.tsx so aria-modal is truthful.
    useEffect(() => {
        if (!panelOpen) return;
        openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
        const panel = panelRef.current;
        panel?.focus();

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const onKey = (event: KeyboardEvent) => {
            // A modal launched from the panel owns Esc and the Tab trap while it is open.
            if (modalOpenRef.current) return;

            if (event.key === "Escape") {
                event.preventDefault();
                setSelectedBranch(null);
                return;
            }

            if (event.key === "Tab" && panel) {
                const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
                    (node) => node.offsetParent !== null
                );
                if (nodes.length === 0) {
                    event.preventDefault();
                    return;
                }
                const firstEl = nodes[0];
                const lastEl = nodes[nodes.length - 1];
                const active = document.activeElement as HTMLElement | null;

                // Focus starts on the panel container, so also wrap when focus has
                // drifted outside the drawer entirely.
                if (event.shiftKey) {
                    if (active === firstEl || active === panel || !panel.contains(active)) {
                        event.preventDefault();
                        lastEl.focus();
                    }
                } else if (active === lastEl || !panel.contains(active)) {
                    event.preventDefault();
                    firstEl.focus();
                }
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
            openerRef.current?.focus?.();
        };
    }, [panelOpen]);

    return (
        <div className="mx-auto w-full max-w-[1400px]">
            <DemoDataBanner note="Demo data — the branch list and create/edit actions are placeholders not yet wired to a backend." />

            <PageHeader
                title="Branch management"
                crumbs={[{ label: "Super admin", href: "/superadmin" }, { label: "Branch management" }]}
                meta={
                    <>
                        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Hospital branches, health scores and settings</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                            {mockBranches.length} {mockBranches.length === 1 ? "branch" : "branches"}
                        </span>
                    </>
                }
                actions={
                    <Button variant="primary" icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
                        Add branch
                    </Button>
                }
            />

            <SectionCard title="Active branches" count={mockBranches.length} flush>
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
                        <tbody className="divide-y divide-edge whitespace-nowrap">
                            {mockBranches.map((branch) => (
                                <tr key={branch.id} className="transition-colors hover:bg-surface-hover">
                                    <td className="py-2 pl-4 pr-3 font-mono text-xs font-medium text-fg">{branch.id}</td>
                                    <td className="truncate px-3 py-2 font-medium text-fg" title={branch.name}>
                                        {branch.name}
                                    </td>
                                    <td className="truncate px-3 py-2 text-fg-secondary" title={branch.location}>
                                        {branch.location}
                                    </td>
                                    <td className="px-3 py-2">
                                        <StatusChip tone={toneForStatus(branch.status)} dot size="sm">
                                            {humanizeStatus(branch.status)}
                                        </StatusChip>
                                    </td>
                                    <td className="py-2 pl-3 pr-4 text-right">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setSelectedBranch(branch.id)}
                                            aria-label={`View details for ${branch.name}`}
                                            aria-expanded={selectedBranch === branch.id}
                                        >
                                            View details
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>

            {/* Slide-out panel backdrop */}
            {panelOpen && (
                <div
                    className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[1px] transition-opacity"
                    onClick={() => setSelectedBranch(null)}
                    aria-hidden="true"
                />
            )}

            {/* Slide-out panel */}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal={panelOpen || undefined}
                aria-label="Branch details"
                aria-hidden={!panelOpen}
                tabIndex={-1}
                className={cn(
                    "fixed inset-y-0 right-0 z-[100] w-full max-w-[440px] transform border-l border-edge bg-surface shadow-2xl shadow-black/20 outline-none transition-transform duration-300 ease-in-out",
                    panelOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
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
