"use client";

import { useEffect, useId, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/Field";

interface UserRecord {
    id: string;
    name: string;
    email: string;
    branch: string;
    roles: string[];
    status: "ACTIVE" | "INACTIVE";
    lastLogin: string;
}

interface UserEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: UserRecord | null;
}

export default function UserEditModal({ isOpen, onClose, userData }: UserEditModalProps) {
    const formId = useId();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        branch: "Colombo",
        role: "Branch Admin",
        status: "ACTIVE",
    });

    useEffect(() => {
        if (userData) {
            setFormData({
                name: userData.name,
                email: userData.email,
                branch: userData.branch,
                role: userData.roles[0] || "Consultant",
                status: userData.status,
            });
        }
    }, [userData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Saving user changes:", formData);
        onClose();
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Edit user"
            description={userData ? `${userData.name} · ${userData.id}` : "Update identity details and access level"}
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
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                >
                    <option value="Colombo">Colombo</option>
                    <option value="Kandy">Kandy</option>
                    <option value="Galle">Galle</option>
                </SelectField>

                <SelectField label="Role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                    <option value="Consultant">Consultant</option>
                    <option value="Branch Admin">Branch Admin</option>
                    <option value="Nursing Head">Nursing Head</option>
                    <option value="Doctor">Doctor</option>
                    <option value="Dept Head">Dept Head</option>
                </SelectField>
            </form>
        </Modal>
    );
}
