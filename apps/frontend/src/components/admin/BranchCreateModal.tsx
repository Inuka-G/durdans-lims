"use client";

import { useId, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/Field";

interface BranchCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
}

export default function BranchCreateModal({ isOpen, onClose, onSave }: BranchCreateModalProps) {
    const formId = useId();
    const [formData, setFormData] = useState({
        code: "",
        name: "",
        location: "",
        contactEmail: "",
        contactPhone: "",
        status: "Active",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onSave(formData);
        } catch (error) {
            console.error(error);
            return;
        }

        // Reset and close
        setFormData({
            code: "",
            name: "",
            location: "",
            contactEmail: "",
            contactPhone: "",
            status: "Active",
        });
        onClose();
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Add branch"
            description="Register a new laboratory branch"
            size="md"
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" form={formId} variant="primary">
                        Create branch
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField
                    label="Branch Code"
                    required
                    type="text"
                    placeholder="e.g. BR-01"
                    className="sm:col-span-2"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />

                <InputField
                    label="Branch name"
                    required
                    type="text"
                    placeholder="e.g. Colombo Main Branch"
                    className="sm:col-span-2"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                <InputField
                    label="Location (city or area)"
                    required
                    type="text"
                    placeholder="e.g. Colombo 07"
                    className="sm:col-span-2"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />

                <InputField
                    label="Contact email"
                    type="email"
                    placeholder="colombo@hospital.com"
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
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                </SelectField>
            </form>
        </Modal>
    );
}