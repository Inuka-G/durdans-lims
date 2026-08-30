"use client";

import { useId, useState } from "react";
import { AlertCircle } from "lucide-react";
import { createBranch } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/Field";

interface BranchCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called after a successful create so the caller can refresh its list. */
    onCreated?: () => void;
}

const EMPTY_FORM = {
    code: "",
    branchName: "",
    location: "",
    contactEmail: "",
    contactPhone: "",
    status: "ACTIVE",
};

export default function BranchCreateModal({ isOpen, onClose, onCreated }: BranchCreateModalProps) {
    const formId = useId();
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            await createBranch({
                code: formData.code.trim().toUpperCase(),
                name: formData.branchName,
                location: formData.location || undefined,
                contactEmail: formData.contactEmail || undefined,
                contactPhone: formData.contactPhone || undefined,
                status: formData.status as "ACTIVE" | "INACTIVE",
            });
            setFormData(EMPTY_FORM);
            onCreated?.();
            onClose();
        } catch (err) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Failed to create branch. The code may already be in use.";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            dismissible={!submitting}
            title="Add branch"
            description="Register a new laboratory branch"
            size="md"
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" form={formId} variant="primary" loading={submitting}>
                        {submitting ? "Creating…" : "Create branch"}
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
                    label="Branch code"
                    required
                    type="text"
                    placeholder="e.g. COL-16"
                    className="sm:col-span-2"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />

                <InputField
                    label="Branch name"
                    required
                    type="text"
                    placeholder="e.g. Colombo 16 Branch"
                    className="sm:col-span-2"
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                />

                <InputField
                    label="Location (city or area)"
                    type="text"
                    placeholder="e.g. Colombo 07"
                    className="sm:col-span-2"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />

                <InputField
                    label="Contact email"
                    type="email"
                    placeholder="colombo@durdans.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />

                <InputField
                    label="Contact phone"
                    type="tel"
                    placeholder="+94 XX XXX XXXX"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                />

                <SelectField
                    label="Initial status"
                    className="sm:col-span-2"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                    <option value="ACTIVE">Active / operational</option>
                    <option value="INACTIVE">Inactive</option>
                </SelectField>
            </form>
        </Modal>
    );
}
