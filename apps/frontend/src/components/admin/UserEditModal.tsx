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
        roles: [] as string[],
    });
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchesLoading, setBranchesLoading] = useState(true);
    const [allowMultipleRoles, setAllowMultipleRoles] = useState(false);

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
                roles: userData.roles || [],
            });
            if (userData.roles && userData.roles.length > 1) {
                setAllowMultipleRoles(true);
            } else {
                setAllowMultipleRoles(false);
            }
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
                    roles: formData.roles,
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
                    role: formData.roles.join(",") || "",
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
                    className="sm:col-span-2"
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

                <div className="sm:col-span-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">Roles</label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-xs font-medium text-gray-500">Allow multiple</span>
                            <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${allowMultipleRoles ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                <input 
                                    type="checkbox" 
                                    className="sr-only" 
                                    checked={allowMultipleRoles}
                                    onChange={(e) => {
                                        const isMulti = e.target.checked;
                                        setAllowMultipleRoles(isMulti);
                                        if (!isMulti && formData.roles.length > 1) {
                                            setFormData({ ...formData, roles: [formData.roles[0]] });
                                        }
                                    }}
                                />
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${allowMultipleRoles ? 'translate-x-4' : 'translate-x-1'}`} />
                            </div>
                        </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                        {ASSIGNABLE_ROLES.map((r) => {
                            const isChecked = formData.roles.includes(r.value);
                            return (
                                <label key={r.value} className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900 select-none">
                                    <input
                                        type={allowMultipleRoles ? "checkbox" : "radio"}
                                        name={`roles-${formId}`}
                                        checked={isChecked}
                                        onChange={(e) => {
                                            if (allowMultipleRoles) {
                                                const newRoles = e.target.checked 
                                                    ? [...formData.roles, r.value] 
                                                    : formData.roles.filter(role => role !== r.value);
                                                setFormData({ ...formData, roles: newRoles });
                                            } else {
                                                setFormData({ ...formData, roles: [r.value] });
                                            }
                                        }}
                                        className={allowMultipleRoles 
                                            ? "h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors" 
                                            : "h-4 w-4 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors"
                                        }
                                    />
                                    <span>{r.label}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            </form>
        </Modal>
    );
}
