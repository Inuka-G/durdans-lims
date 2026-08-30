"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Search, User, UserX } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import StatusChip from "@/components/ui/StatusChip";
import EmptyState from "@/components/ui/EmptyState";
import { CONTROL_CLASS } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { AdminUser, Branch, assignBranchAdmin, getAdminUsers } from "@/lib/api";

interface AssignAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called after a successful assignment so the caller can refresh its list. */
    onAssigned?: () => void;
    branch: Branch | null;
}

function initials(name: string) {
    return (
        name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase() || "?"
    );
}

function displayName(u: AdminUser) {
    return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username;
}

export default function AssignAdminModal({ isOpen, onClose, onAssigned, branch }: AssignAdminModalProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        setLoadError(null);
        getAdminUsers()
            .then(setUsers)
            .catch(() => setLoadError("User administration is unavailable. Enable the Keycloak admin module on the backend (app.keycloak-admin.enabled)."))
            .finally(() => setLoading(false));
    }, [isOpen]);

    const filtered = users.filter(
        (u) =>
            displayName(u).toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAssign = async (user: AdminUser) => {
        if (!branch) return;
        setAssigningId(user.id);
        try {
            await assignBranchAdmin(branch.code, user.id, displayName(user), user.email);
            onAssigned?.();
            onClose();
        } catch {
            setLoadError("Failed to assign this user as branch admin.");
        } finally {
            setAssigningId(null);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Assign branch admin"
            description={branch?.name}
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
                            {branch?.adminUserId ? (
                                <>
                                    <p className="truncate text-sm font-medium text-fg">{branch.adminName}</p>
                                    <p className="truncate text-xs text-fg-muted">{branch.adminEmail}</p>
                                </>
                            ) : (
                                <p className="truncate text-sm font-medium text-fg-muted">Unassigned</p>
                            )}
                        </div>
                    </div>
                    {branch?.adminUserId && (
                        <StatusChip tone="success" dot className="hidden sm:inline-flex">
                            Active
                        </StatusChip>
                    )}
                </div>

                {loadError && (
                    <div
                        role="alert"
                        className="flex items-start gap-2 rounded-md bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg ring-1 ring-inset ring-status-danger-edge"
                    >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{loadError}</span>
                    </div>
                )}

                {!loadError && (
                    <>
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
                                {loading ? "Loading users…" : (
                                    <>Available users <span className="tabular-nums">({filtered.length})</span></>
                                )}
                            </h3>

                            {loading ? (
                                <ul aria-hidden="true" className="divide-y divide-edge rounded-md border border-edge">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                                            <span className="h-8 w-8 shrink-0 rounded-full bg-skeleton" />
                                            <span className="h-3 w-40 rounded bg-skeleton" />
                                        </li>
                                    ))}
                                </ul>
                            ) : filtered.length > 0 ? (
                                <ul className="divide-y divide-edge rounded-md border border-edge">
                                    {filtered.map((u) => {
                                        const assigning = assigningId === u.id;
                                        const name = displayName(u);
                                        return (
                                            <li
                                                key={u.id}
                                                className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-surface-hover"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <span
                                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[12px] font-semibold text-fg-secondary ring-1 ring-inset ring-edge"
                                                        aria-hidden="true"
                                                    >
                                                        {initials(name)}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium text-fg">{name}</p>
                                                        <p className="truncate text-xs text-fg-muted">
                                                            {u.branchCode ?? "No branch"} · {u.email}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    disabled={assigningId !== null}
                                                    onClick={() => handleAssign(u)}
                                                    loading={assigning}
                                                    aria-label={`Assign ${name} as branch admin`}
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
                                        description={
                                            users.length === 0
                                                ? "No users exist yet — create one from Global user control first."
                                                : `Nothing matches "${searchQuery}". Try a different name or email.`
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
