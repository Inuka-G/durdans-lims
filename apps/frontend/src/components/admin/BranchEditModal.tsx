"use client";

import { useEffect, useId, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Branch, updateBranch } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/Field";

interface BranchEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called after a successful save so the caller can refresh its list. */
    onSaved?: () => void;
    branchData?: Branch | null;
}

const EMPTY_FORM = {
    branchName: "",
    location: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    status: "ACTIVE",
    legalEntityName: "",
    establishedDate: "",
};

export default function BranchEditModal({ isOpen, onClose, onSaved, branchData }: BranchEditModalProps) {
    const formId = useId();
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (branchData) {
            setFormData({
                branchName: branchData.name,
                location: branchData.location ?? "",
                address: branchData.address ?? "",
                contactEmail: branchData.contactEmail ?? "",
                contactPhone: branchData.contactPhone ?? "",
                status: branchData.status,
                legalEntityName: branchData.legalEntityName ?? "",
                establishedDate: branchData.establishedDate ?? "",
            });
            setError(null);
        }
    }, [branchData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!branchData) return;
        setSubmitting(true);
        setError(null);
        try {
            await updateBranch(branchData.code, {
                name: formData.branchName,
                location: formData.location,
                address: formData.address,
                contactEmail: formData.contactEmail,
                contactPhone: formData.contactPhone,
                status: formData.status as "ACTIVE" | "INACTIVE",
                legalEntityName: formData.legalEntityName,
                establishedDate: formData.establishedDate || undefined,
            });
            onSaved?.();
            onClose();
        } catch {
            setError("Failed to save changes.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            dismissible={!submitting}
            title="Edit branch"
            description={branchData ? `${branchData.name} · ${branchData.code}` : undefined}
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
                    label="Branch name"
                    required
                    type="text"
                    className="sm:col-span-2"
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                />

                <InputField
                    label="Location (city or area)"
                    type="text"
                    placeholder="e.g. Colombo 07"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />

                <InputField
                    label="Established"
                    type="date"
                    value={formData.establishedDate}
                    onChange={(e) => setFormData({ ...formData, establishedDate: e.target.value })}
                />

                <InputField
                    label="Address"
                    type="text"
                    className="sm:col-span-2"
                    placeholder="Street, city, postal code"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />

                <InputField
                    label="Legal entity name"
                    type="text"
                    className="sm:col-span-2"
                    value={formData.legalEntityName}
                    onChange={(e) => setFormData({ ...formData, legalEntityName: e.target.value })}
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
                    label="Status"
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
