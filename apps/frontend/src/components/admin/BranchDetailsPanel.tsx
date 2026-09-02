"use client";

import { Mail, MapPin, Pencil, Phone, User, X } from "lucide-react";
import Button from "@/components/ui/Button";
import SectionCard from "@/components/ui/SectionCard";
import StatusChip from "@/components/ui/StatusChip";
import { formatPhone, formatRegistered } from "@/components/patient-dashboard/dashboard-data";
import { BranchResponse } from "@/lib/api";

interface BranchDetailsPanelProps {
    onClose: () => void;
    onEditClick?: () => void;
    onChangeAdminClick?: () => void;
    branch?: BranchResponse | null;
}

const RING_PATH = "M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831";

export default function BranchDetailsPanel({ onClose, onEditClick, onChangeAdminClick, branch }: BranchDetailsPanelProps) {
    if (!branch) return null;

    // Use a mock health score for now as it's not in the API
    const healthScore = 92;

    return (
        <div className="flex h-full flex-col overflow-hidden bg-surface text-fg">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-edge bg-surface px-4 py-4">
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-fg">Branch details</h2>
                    <p className="mt-0.5 text-xs text-fg-muted">Monitoring and administrative controls</p>
                </div>
                <button
                    type="button"
                    className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    onClick={onClose}
                >
                    <span className="sr-only">Close panel</span>
                    <X className="h-5 w-5" aria-hidden="true" />
                </button>
            </header>

            {/* Scrollable body */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-canvas p-4">
                {/* Health score */}
                <SectionCard title="Branch health">
                    <div className="flex items-center gap-4">
                        <div
                            className="relative flex h-20 w-20 shrink-0 items-center justify-center"
                            role="img"
                            aria-label={`Health score ${healthScore} percent`}
                        >
                            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                                <path d={RING_PATH} fill="none" stroke="var(--edge)" strokeWidth="4" />
                                <path
                                    d={RING_PATH}
                                    fill="none"
                                    stroke="var(--color-primary)"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={`${healthScore}, 100`}
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center">
                                <span className="text-lg font-semibold leading-none tabular-nums text-fg">{healthScore}%</span>
                                <span className="mt-0.5 text-[10px] text-fg-muted">health</span>
                            </div>
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-fg">Excellent performance</p>
                            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                                Based on server uptime, patient throughput and staff activity logs.
                            </p>
                        </div>
                    </div>
                </SectionCard>

                {/* Branch information */}
                <SectionCard title="Branch information">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                        <div>
                            <dt className="text-xs text-fg-muted">Branch ID</dt>
                            <dd className="mt-0.5 font-medium tabular-nums text-fg">{branch.code}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-fg-muted">Established</dt>
                            <dd className="mt-0.5 font-medium text-fg">{branch.establishedDate ? formatRegistered(new Date(branch.establishedDate)) : "Not set"}</dd>
                        </div>
                        <div className="col-span-2">
                            <dt className="text-xs text-fg-muted">Legal entity name</dt>
                            <dd className="mt-0.5 font-medium text-fg">{branch.legalEntityName || "Not set"}</dd>
                        </div>
                    </dl>
                </SectionCard>

                {/* Contact details */}
                <SectionCard title="Contact details">
                    <dl className="flex flex-col gap-3 text-[13px]">
                        <div className="flex items-start gap-3">
                            <dt className="mt-0.5 shrink-0 text-fg-faint">
                                <MapPin className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Address</span>
                            </dt>
                            <dd className="min-w-0 leading-snug text-fg-secondary">{branch.address || "Not set"}</dd>
                        </div>
                        <div className="flex items-start gap-3">
                            <dt className="mt-0.5 shrink-0 text-fg-faint">
                                <Phone className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Phone</span>
                            </dt>
                            <dd className="min-w-0 tabular-nums text-fg-secondary">{branch.contactPhone ? formatPhone(branch.contactPhone) : "Not set"}</dd>
                        </div>
                        <div className="flex items-start gap-3">
                            <dt className="mt-0.5 shrink-0 text-fg-faint">
                                <Mail className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Email</span>
                            </dt>
                            <dd className="min-w-0 break-all text-fg-secondary">{branch.contactEmail || "Not set"}</dd>
                        </div>
                    </dl>
                </SectionCard>

                {/* Branch admin */}
                <SectionCard
                    title="Assigned branch admin"
                    actions={
                        <Button size="sm" variant="ghost" onClick={onChangeAdminClick} aria-label="Change branch admin">
                            Change
                        </Button>
                    }
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-faint ring-1 ring-inset ring-edge">
                                <User className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium text-fg">{branch.adminName || "No admin assigned"}</p>
                                <p className="truncate text-xs text-fg-muted">{branch.adminEmail || "—"}</p>
                            </div>
                        </div>
                        <StatusChip tone={branch.status === 'ACTIVE' ? "success" : "neutral"} dot size="sm">
                            {branch.status || "Active"}
                        </StatusChip>
                    </div>
                </SectionCard>
            </div>

            {/* Sticky actions footer */}
            <footer className="flex items-center justify-end gap-2 border-t border-edge bg-surface px-4 py-3">
                <Button variant="ghost" onClick={onClose}>
                    Close
                </Button>
                <Button variant="secondary" icon={Pencil} onClick={onEditClick}>
                    Edit branch
                </Button>
            </footer>
        </div>
    );
}