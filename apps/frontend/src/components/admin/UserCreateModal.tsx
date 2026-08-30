"use client";

import { useId, useState } from "react";
import { AlertCircle } from "lucide-react";
import { ADMIN_BRANCH_OPTIONS, ASSIGNABLE_ROLES, createAdminUser } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { InputField, SelectField } from "@/components/ui/Field";

interface UserCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type UserStatus = "ACTIVE" | "INACTIVE";

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
];

const EMPTY_FORM = {
    name: "",
    email: "",
    branch: ADMIN_BRANCH_OPTIONS[0].value,
    role: ASSIGNABLE_ROLES[0].value,
    status: "ACTIVE" as UserStatus,
    temporaryPassword: "",
};

export default function UserCreateModal({ isOpen, onClose }: UserCreateModalProps) {
    const formId = useId();
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const trimmed = formData.name.trim();
            const sp = trimmed.indexOf(" ");
            const firstName = sp === -1 ? trimmed : trimmed.slice(0, sp);
            const lastName = sp === -1 ? "" : trimmed.slice(sp + 1);
            await createAdminUser({
                username: formData.email.split("@")[0] || formData.email,
                email: formData.email,
                firstName,
                lastName,
                role: formData.role,
                branchCode: formData.branch,
                temporaryPassword: formData.temporaryPassword,
                enabled: formData.status === "ACTIVE",
            });
            setFormData(EMPTY_FORM);
            onClose();
        } catch {
            setError("Failed to create user. Ensure the Keycloak admin module is enabled and the role/branch are valid.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            dismissible={!submitting}
            title="Create user"
            description="Provision a new identity for the system"
            size="md"
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" form={formId} variant="primary" loading={submitting}>
                        {submitting ? "Creating…" : "Create user"}
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
                    placeholder="e.g. Dr. Jane Doe"
                    autoComplete="off"
                    className="sm:col-span-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                <InputField
                    label="Email address"
                    required
                    type="email"
                    placeholder="jane.d@durdans.com"
                    autoComplete="off"
                    className="sm:col-span-2"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />

                <InputField
                    label="Temporary password"
                    required
                    type="text"
                    placeholder="Given to the user to sign in and change on first login"
                    autoComplete="off"
                    className="sm:col-span-2"
                    value={formData.temporaryPassword}
                    onChange={(e) => setFormData({ ...formData, temporaryPassword: e.target.value })}
                />

                <SelectField
                    label="Branch"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                >
                    {ADMIN_BRANCH_OPTIONS.map((b) => (
                        <option key={b.value} value={b.value}>
                            {b.label}
                        </option>
                    ))}
                </SelectField>

                <SelectField label="Role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                    {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                            {r.label}
                        </option>
                    ))}
                </SelectField>

                <div className="sm:col-span-2">
                    <p className="mb-1 text-xs font-medium text-fg-secondary">Initial status</p>
                    <SegmentedControl<UserStatus>
                        ariaLabel="Initial status"
                        value={formData.status}
                        onChange={(next) => setFormData({ ...formData, status: next })}
                        options={STATUS_OPTIONS}
                    />
                </div>
            </form>
        </Modal>
    );
}
