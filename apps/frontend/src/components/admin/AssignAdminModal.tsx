"use client";

import { useState } from "react";
import { Search, User, UserX } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import StatusChip from "@/components/ui/StatusChip";
import EmptyState from "@/components/ui/EmptyState";
import { CONTROL_CLASS } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

interface AssignAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentAdmin?: {
        name: string;
        email: string;
    };
    branchName?: string;
}

// Mock users available for assignment
const MOCK_AVAILABLE_ADMINS = [
    { id: "USR-0812", name: "Sunil Perera", email: "sunil.p@durdans.com", role: "Senior Administrator" },
    { id: "USR-0921", name: "Malini Fonseka", email: "malini.f@durdans.com", role: "Operations Manager" },
    { id: "USR-1044", name: "Kasun Kalhara", email: "kasun.k@durdans.com", role: "Branch Admin" },
    { id: "USR-1102", name: "Dr. Ramesh Silva", email: "ramesh.s@durdans.com", role: "Medical Director" },
];

function initials(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
}

export default function AssignAdminModal({
    isOpen,
    onClose,
    currentAdmin = { name: "Arjuna Kariyawasam", email: "arjuna.k@durdans.com" },
    branchName = "Colombo Main Branch",
}: AssignAdminModalProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [assigningId, setAssigningId] = useState<string | null>(null);

    const filteredAdmins = MOCK_AVAILABLE_ADMINS.filter(
        (admin) =>
            admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            admin.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAssign = (adminId: string) => {
        setAssigningId(adminId);
        // Simulate API call delay
        setTimeout(() => {
            console.log(`Assigned admin ${adminId} to ${branchName}`);
            setAssigningId(null);
            onClose();
        }, 800);
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Assign branch admin"
            description={branchName}
            size="lg"
            footer={<Button onClick={onClose}>Cancel</Button>}
        >
            <div className="flex flex-col gap-4">
                {/* Current admin */}
                <div className="flex items-center justify-between gap-3 rounded-md border border-edge bg-surface-muted px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge bg-surface text-fg-faint">
                            <User className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs text-fg-muted">Current admin</p>
                            <p className="truncate text-sm font-medium text-fg">{currentAdmin.name}</p>
                            <p className="truncate text-xs text-fg-muted">{currentAdmin.email}</p>
                        </div>
                    </div>
                    <StatusChip tone="success" dot className="hidden sm:inline-flex">
                        Active
                    </StatusChip>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint"
                        aria-hidden="true"
                    />
                    <input
                        type="search"
                        aria-label="Search users by name or email"
                        placeholder="Search users by name or email"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={cn(CONTROL_CLASS, "h-9 pl-9")}
                    />
                </div>

                {/* Available users */}
                <div>
                    <h3 className="mb-2 text-xs font-semibold text-fg-muted">
                        Available users <span className="tabular-nums">({filteredAdmins.length})</span>
                    </h3>

                    {filteredAdmins.length > 0 ? (
                        <ul className="divide-y divide-edge rounded-md border border-edge">
                            {filteredAdmins.map((admin) => {
                                const assigning = assigningId === admin.id;
                                return (
                                    <li
                                        key={admin.id}
                                        className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-surface-hover"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span
                                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[12px] font-semibold text-fg-secondary ring-1 ring-inset ring-edge"
                                                aria-hidden="true"
                                            >
                                                {initials(admin.name)}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-fg">{admin.name}</p>
                                                <p className="truncate text-xs text-fg-muted">
                                                    {admin.role} · {admin.email}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => handleAssign(admin.id)}
                                            loading={assigning}
                                            aria-label={`Assign ${admin.name} as branch admin`}
                                        >
                                            {assigning ? "Assigning…" : "Assign"}
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="rounded-md border border-dashed border-edge" role="status">
                            <EmptyState
                                compact
                                icon={UserX}
                                title="No users found"
                                description={`Nothing matches "${searchQuery}". Try a different name or email.`}
                            />
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
