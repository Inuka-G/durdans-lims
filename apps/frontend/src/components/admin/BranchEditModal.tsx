"use client";

import { useEffect, useId, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/Field";

interface BranchEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchData?: {
        id: string;
        name: string;
        location: string;
        status: string;
    } | null;
}

export default function BranchEditModal({ isOpen, onClose, branchData }: BranchEditModalProps) {
    const formId = useId();
    const [formData, setFormData] = useState({
        branchName: "",
        location: "",
        contactEmail: "",
        contactPhone: "",
        status: "Active",
    });

    useEffect(() => {
        if (branchData) {
            setFormData({
                branchName: branchData.name,
                location: branchData.location,
                contactEmail: "colombo.main@laborp.com", // mocked default
                contactPhone: "+94 11 2345 678", // mocked default
                status: branchData.status,
            });
        }
    }, [branchData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Here you would typically handle the API submission
        console.log("Submitting branch updates:", formData);
        onClose();
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Edit branch"
            description={branchData ? `${branchData.name} · ${branchData.id}` : undefined}
            size="md"
            footer={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" form={formId} variant="primary">
                        Save changes
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField
                    label="Branch name"
                    required
                    type="text"
                    placeholder="e.g. Colombo Main Branch"
                    className="sm:col-span-2"
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
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
                    label="Status"
                    className="sm:col-span-2"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                    <option value="Active">Active / operational</option>
                    <option value="In Setup">In setup phase</option>
                    <option value="Maintainance">Under maintenance</option>
                </SelectField>
            </form>
        </Modal>
    );
}
