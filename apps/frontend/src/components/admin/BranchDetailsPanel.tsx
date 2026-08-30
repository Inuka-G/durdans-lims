"use client";

import { Mail, MapPin, Pencil, Phone, User, UserPlus, X } from "lucide-react";
import Button from "@/components/ui/Button";
import SectionCard from "@/components/ui/SectionCard";
import StatusChip, { toneForStatus } from "@/components/ui/StatusChip";
import { Branch } from "@/lib/api";

interface BranchDetailsPanelProps {
    branch: Branch;
    onClose: () => void;
    onEditClick?: () => void;
    onChangeAdminClick?: () => void;
}

function formatEstablished(date: string | null): string {
    if (!date) return "Not set";
    return new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function BranchDetailsPanel({ branch, onClose, onEditClick, onChangeAdminClick }: BranchDetailsPanelProps) {
    return (
        <div className="flex h-full flex-col overflow-hidden bg-surface text-fg">
            {/* Header */}
            <header className="flex items-start justify-between gap-3 border-b border-edge px-5 py-4">
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-fg">{branch.name}</h2>
                    <p className="mt-0.5 text-xs text-fg-muted">{branch.code}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close branch details"
                    className="-mr-1.5 -mt-1 rounded p-1.5 text-fg-faint transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            </header>

            {/* Scrollable body */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-canvas p-4">
                {/* Branch information */}
                <SectionCard title="Branch information">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div>
                            <dt className="text-xs text-fg-muted">Branch code</dt>
                            <dd className="mt-0.5 font-medium tabular-nums text-fg">{branch.code}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-fg-muted">Status</dt>
                            <dd className="mt-0.5">
                                <StatusChip tone={toneForStatus(branch.status)} dot size="sm">
                                    {branch.status === "ACTIVE" ? "Active" : "Inactive"}
                                </StatusChip>
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-fg-muted">Location</dt>
                            <dd className="mt-0.5 font-medium text-fg">{branch.location || <span className="text-fg-faint">Not set</span>}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-fg-muted">Established</dt>
                            <dd className="mt-0.5 font-medium text-fg">{formatEstablished(branch.establishedDate)}</dd>
                        </div>
                        <div className="col-span-2">
                            <dt className="text-xs text-fg-muted">Legal entity name</dt>
                            <dd className="mt-0.5 font-medium text-fg">
                                {branch.legalEntityName || <span className="text-fg-faint">Not set</span>}
                            </dd>
                        </div>
                    </dl>
                </SectionCard>

                {/* Contact details */}
                <SectionCard title="Contact details">
                    <dl className="flex flex-col gap-3 text-sm">
                        <div className="flex items-start gap-3">
                            <dt className="mt-0.5 shrink-0 text-fg-faint">
                                <MapPin className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Address</span>
                            </dt>
                            <dd className="min-w-0 leading-snug text-fg-secondary">
                                {branch.address || <span className="text-fg-faint">Not set</span>}
                            </dd>
                        </div>
                        <div className="flex items-start gap-3">
                            <dt className="mt-0.5 shrink-0 text-fg-faint">
                                <Phone className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Phone</span>
                            </dt>
                            <dd className="min-w-0 tabular-nums text-fg-secondary">
                                {branch.contactPhone || <span className="text-fg-faint">Not set</span>}
                            </dd>
                        </div>
                        <div className="flex items-start gap-3">
                            <dt className="mt-0.5 shrink-0 text-fg-faint">
                                <Mail className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Email</span>
                            </dt>
                            <dd className="min-w-0 break-all text-fg-secondary">
                                {branch.contactEmail || <span className="text-fg-faint">Not set</span>}
                            </dd>
                        </div>
                    </dl>
                </SectionCard>

                {/* Assigned branch admin */}
                <SectionCard
                    title="Assigned branch admin"
                    actions={
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onChangeAdminClick}
                            aria-label={branch.adminUserId ? "Change branch admin" : "Assign branch admin"}
                        >
                            {branch.adminUserId ? "Change" : "Assign"}
                        </Button>
                    }
                >
                    {branch.adminUserId ? (
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-faint ring-1 ring-inset ring-edge">
                                    <User className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-fg">{branch.adminName}</p>
                                    <p className="truncate text-xs text-fg-muted">{branch.adminEmail}</p>
                                </div>
                            </div>
                            <StatusChip tone="success" dot size="sm">
                                Active
                            </StatusChip>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 text-sm text-fg-muted">
                            <UserPlus className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                            No admin assigned yet.
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* Sticky actions footer */}
            <footer className="flex items-center justify-end gap-2 border-t border-edge bg-surface px-4 py-3">
                <Button href="/superadmin/admin/audit">Audit log</Button>
                <Button variant="primary" icon={Pencil} onClick={onEditClick}>
                    Edit branch
                </Button>
            </footer>
        </div>
    );
}
