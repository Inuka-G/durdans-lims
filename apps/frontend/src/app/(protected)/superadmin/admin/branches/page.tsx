"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Building2, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Branch, getBranches } from "@/lib/api";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip, { toneForStatus } from "@/components/ui/StatusChip";
import BranchDetailsPanel from "@/components/admin/BranchDetailsPanel";
import BranchCreateModal from "@/components/admin/BranchCreateModal";
import BranchEditModal from "@/components/admin/BranchEditModal";
import AssignAdminModal from "@/components/admin/AssignAdminModal";

// Same selector Modal.tsx traps against, so the drawer behaves like the dialog it claims to be.
const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const SKELETON_ROWS = 5;

export default function BranchManagementPage() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAssignAdminModalOpen, setIsAssignAdminModalOpen] = useState(false);

    const panelRef = useRef<HTMLDivElement | null>(null);
    const openerRef = useRef<HTMLElement | null>(null);
    const modalOpenRef = useRef(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getBranches();
            setBranches(data);
        } catch {
            setError("Could not load the branch directory.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const activeBranchData = branches.find((b) => b.code === selectedBranch) ?? null;
    const panelOpen = Boolean(activeBranchData);

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

    const showErrorState = !!error && branches.length === 0;
    const showErrorBanner = !!error && branches.length > 0;

    return (
        <div className="mx-auto w-full max-w-[1400px]">
            <PageHeader
                title="Branch management"
                crumbs={[{ label: "Super admin", href: "/superadmin" }, { label: "Branch management" }]}
                meta={
                    <>
                        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Hospital branches, contact details and assigned admins</span>
                        {!loading && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {branches.length} {branches.length === 1 ? "branch" : "branches"}
                                </span>
                            </>
                        )}
                    </>
                }
                actions={
                    <>
                        <Button icon={RefreshCw} onClick={load} loading={loading && branches.length > 0}>
                            Refresh
                        </Button>
                        <Button variant="primary" icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
                            Add branch
                        </Button>
                    </>
                }
            />

            {showErrorBanner && (
                <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-md bg-status-danger-bg px-3 py-2 text-xs text-status-danger-fg ring-1 ring-inset ring-status-danger-edge"
                >
                    <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            <SectionCard title="Branches" count={loading ? undefined : branches.length} flush>
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-16 shrink-0 rounded bg-skeleton" />
                                <span className="h-4 w-40 shrink-0 rounded bg-skeleton" />
                                <span className="hidden h-3 w-24 rounded bg-skeleton md:block" />
                                <span className="h-4 w-14 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : showErrorState ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Branch directory unavailable"
                        description={error ?? undefined}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={load}>
                                Retry
                            </Button>
                        }
                    />
                ) : branches.length === 0 ? (
                    <EmptyState
                        icon={Building2}
                        title="No branches yet"
                        description="Register the first branch to get started."
                        action={
                            <Button size="sm" icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
                                Add branch
                            </Button>
                        }
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                            <caption className="sr-only">Hospital branches</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-28 py-2 pl-4 pr-3 font-semibold">
                                        Code
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-semibold">
                                        Branch
                                    </th>
                                    <th scope="col" className="hidden w-40 px-3 py-2 font-semibold md:table-cell">
                                        Location
                                    </th>
                                    <th scope="col" className="hidden w-52 px-3 py-2 font-semibold lg:table-cell">
                                        Admin
                                    </th>
                                    <th scope="col" className="w-24 px-3 py-2 font-semibold">
                                        Status
                                    </th>
                                    <th scope="col" className="w-32 py-2 pl-3 pr-4 text-right font-semibold">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {branches.map((branch) => (
                                    <tr key={branch.code} className="transition-colors hover:bg-surface-hover">
                                        <td className="py-2 pl-4 pr-3 font-mono text-xs font-medium text-fg">{branch.code}</td>
                                        <td className="truncate px-3 py-2 font-medium text-fg" title={branch.name}>
                                            {branch.name}
                                        </td>
                                        <td className="hidden truncate px-3 py-2 text-fg-secondary md:table-cell">
                                            {branch.location || <span className="text-fg-faint">—</span>}
                                        </td>
                                        <td className="hidden truncate px-3 py-2 text-fg-secondary lg:table-cell">
                                            {branch.adminName || <span className="text-fg-faint">Unassigned</span>}
                                        </td>
                                        <td className="px-3 py-2">
                                            <StatusChip tone={toneForStatus(branch.status)} dot size="sm">
                                                {branch.status === "ACTIVE" ? "Active" : "Inactive"}
                                            </StatusChip>
                                        </td>
                                        <td className="py-2 pl-3 pr-4 text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setSelectedBranch(branch.code)}
                                                aria-label={`View details for ${branch.name}`}
                                                aria-expanded={selectedBranch === branch.code}
                                            >
                                                View details
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
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
                {activeBranchData && (
                    <BranchDetailsPanel
                        branch={activeBranchData}
                        onClose={() => setSelectedBranch(null)}
                        onEditClick={() => setIsEditModalOpen(true)}
                        onChangeAdminClick={() => setIsAssignAdminModalOpen(true)}
                    />
                )}
            </div>

            {/* Create Branch Modal */}
            <BranchCreateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreated={load} />

            {/* Edit Branch Modal */}
            <BranchEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSaved={load}
                branchData={activeBranchData}
            />

            {/* Assign Admin Modal */}
            <AssignAdminModal
                isOpen={isAssignAdminModalOpen}
                onClose={() => setIsAssignAdminModalOpen(false)}
                onAssigned={load}
                branch={activeBranchData}
            />
        </div>
    );
}
