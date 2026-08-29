"use client";

import { Mail, MapPin, Pencil, Phone, User, X } from "lucide-react";
import Button from "@/components/ui/Button";
import SectionCard from "@/components/ui/SectionCard";
import StatusChip from "@/components/ui/StatusChip";
import { formatPhone, formatRegistered } from "@/components/patient-dashboard/dashboard-data";

interface BranchDetailsPanelProps {
    onClose: () => void;
    onEditClick?: () => void;
    onChangeAdminClick?: () => void;
    branch?: any;
}

// Mocked branch record (placeholder until the branch API is wired up)
const BRANCH = {
    id: "BR-COL-001",
    established: new Date(2018, 0, 12),
    legalEntity: "Colombo Main General Hospital Laboratory Services",
    address: "No. 420, Bauddhaloka Mawatha, Colombo 07, Sri Lanka",
    phone: "+94 11 2345 678",
    email: "colombo.main@laborp.com",
    healthScore: 92,
    admin: { name: "Arjuna Kariyawasam", email: "arjuna.k@durdans.com" },
};

const RING_PATH = "M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831";

export default function BranchDetailsPanel({ onClose, onEditClick, onChangeAdminClick }: BranchDetailsPanelProps) {
    return (
        <div className="flex h-full flex-col overflow-hidden bg-surface text-fg">
            {/* Header */}
            <header className="flex items-start justify-between gap-3 border-b border-edge px-5 py-4">
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-fg">Branch details</h2>
                    <p className="mt-0.5 text-xs text-fg-muted">Monitoring and administrative controls</p>
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
                {/* Health score */}
                <SectionCard title="Branch health">
                    <div className="flex items-center gap-4">
                        <div
                            className="relative flex h-20 w-20 shrink-0 items-center justify-center"
                            role="img"
                            aria-label={`Health score ${BRANCH.healthScore} percent`}
                        >
                            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                                <path d={RING_PATH} fill="none" stroke="var(--edge)" strokeWidth="4" />
                                <path
                                    d={RING_PATH}
                                    fill="none"
                                    stroke="var(--color-primary)"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={`${BRANCH.healthScore}, 100`}
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center">
                                <span className="text-lg font-semibold leading-none tabular-nums text-fg">{BRANCH.healthScore}%</span>
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
                            <dd className="mt-0.5 font-medium tabular-nums text-fg">{BRANCH.id}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-fg-muted">Established</dt>
                            <dd className="mt-0.5 font-medium text-fg">{formatRegistered(BRANCH.established)}</dd>
                        </div>
                        <div className="col-span-2">
                            <dt className="text-xs text-fg-muted">Legal entity name</dt>
                            <dd className="mt-0.5 font-medium text-fg">{BRANCH.legalEntity}</dd>
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
                            <dd className="min-w-0 leading-snug text-fg-secondary">{BRANCH.address}</dd>
                        </div>
                        <div className="flex items-start gap-3">
                            <dt className="mt-0.5 shrink-0 text-fg-faint">
                                <Phone className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Phone</span>
                            </dt>
                            <dd className="min-w-0 tabular-nums text-fg-secondary">{formatPhone(BRANCH.phone)}</dd>
                        </div>
                        <div className="flex items-start gap-3">
                            <dt className="mt-0.5 shrink-0 text-fg-faint">
                                <Mail className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Email</span>
                            </dt>
                            <dd className="min-w-0 break-all text-fg-secondary">{BRANCH.email}</dd>
                        </div>
                    </dl>
                </SectionCard>

                {/* Assigned branch admin */}
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
                                <p className="truncate text-[13px] font-medium text-fg">{BRANCH.admin.name}</p>
                                <p className="truncate text-xs text-fg-muted">{BRANCH.admin.email}</p>
                            </div>
                        </div>
                        <StatusChip tone="success" dot size="sm">
                            Active
                        </StatusChip>
                    </div>
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
