"use client";

import { useEffect, useId, useState } from "react";
import { AlertCircle } from "lucide-react";
import { ASSIGNABLE_ROLES, Branch, getBranches, updateAdminUser } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/Field";

interface UserRecord {
    id: string;
    name: string;
    email: string;
    branch: string;
    branchId?: string;
    roles: string[];
    status: "ACTIVE" | "INACTIVE";
}

interface UserEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called after a successful save so the caller can refresh its list. */
    onSaved?: () => void;
    onSave?: (id: string, data: Partial<UserRecord>) => Promise<void>;
    userData: UserRecord | null;
}

export default function UserEditModal({ isOpen, onClose, onSaved, onSave, userData }: UserEditModalProps) {
    const formId = useId();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        branch: "",
        branchId: "",
        role: ASSIGNABLE_ROLES[0].value,
    });
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchesLoading, setBranchesLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        setBranchesLoading(true);
        getBranches()
            .then(setBranches)
            .catch(() => setBranches([]))
            .finally(() => setBranchesLoading(false));
    }, [isOpen]);

    useEffect(() => {
        if (userData) {
            setFormData({
                name: userData.name,
                email: userData.email,
                branch: userData.branch,
                branchId: userData.branchId || "",
                role: userData.roles[0] || ASSIGNABLE_ROLES[0].value,
            });
            setError(null);
        }
    }, [userData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userData) return;
        setSubmitting(true);
        setError(null);
        try {
            if (onSave) {
                await onSave(userData.id, {
                    name: formData.name,
                    email: formData.email,
                    roles: [formData.role],
                    branch: formData.branch,
                    branchId: formData.branchId,
                    status: userData.status,
                });
            } else {
                const trimmed = formData.name.trim();
                const sp = trimmed.indexOf(" ");
                const firstName = sp === -1 ? trimmed : trimmed.slice(0, sp);
                const lastName = sp === -1 ? "" : trimmed.slice(sp + 1);
                await updateAdminUser(userData.id, {
                    firstName,
                    lastName,
                    email: formData.email,
                    role: formData.role,
                    branchCode: formData.branch,
                });
            }
            onSaved?.();
            onClose();
        } catch {
            setError("Failed to save changes. Ensure the Keycloak admin module is enabled and the role/branch are valid.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            dismissible={!submitting}
            title="Edit user"
            description={userData ? `${userData.name} · ${userData.id}` : "Update identity details and access level"}
            size="md"
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" form={formId} variant="primary" loading={submitting}>
                        {submitting ? "Saving…" : "Save changes"}
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {error && (
                    <div
                        role="alert"
                        className="flex items-start gap-2 rounded-md bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg ring-1 ring-inset ring-status-danger-edge sm:col-span-2"
                    >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{error}</span>
                    </div>
                )}

                <InputField
                    label="Full name"
                    required
                    type="text"
                    autoComplete="off"
                    className="sm:col-span-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                <InputField
                    label="Email address"
                    required
                    type="email"
                    autoComplete="off"
                    className="sm:col-span-2"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />

                <SelectField
                    label="Branch"
                    disabled={branchesLoading || branches.length === 0}
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                >
                    {branchesLoading ? (
                        <option value={formData.branchId}>Loading branches…</option>
                    ) : (
                        <>
                            {!branches.some((b: any) => b.id === formData.branchId || b.code === formData.branchId) && formData.branchId && (
                                <option value={formData.branchId}>{formData.branch}</option>
                            )}
                            {branches.map((b: any) => (
                                <option key={b.id || b.code} value={b.id || b.code} disabled={b.status === "INACTIVE"}>
                                    {b.name} ({b.code}){b.status === "INACTIVE" ? " - Inactive" : ""}
                                </option>
                            ))}
                        </>
                    )}
                </SelectField>

                <SelectField label="Role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                    {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                            {r.label}
                        </option>
                    ))}
                </SelectField>
            </form>
        </Modal>
    );
}
