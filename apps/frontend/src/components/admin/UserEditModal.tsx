"use client";

import { useEffect, useId, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/Field";

interface UserRecord {
    id: string;
    username: string;
    name: string;
    email: string;
    branchId: string;
    branch: string;
    roles: string[];
    status: "ACTIVE" | "INACTIVE";
    lastLogin: string;
}

import { getBranches, getSuperadminRoles, BranchResponse } from "@/lib/api";

interface UserEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: UserRecord | null;
    onSave: (id: string, data: Partial<UserRecord>) => Promise<void>;
}

export default function UserEditModal({ isOpen, onClose, userData, onSave }: UserEditModalProps) {
    const formId = useId();
    const [formData, setFormData] = useState({
        username: "",
        name: "",
        email: "",
        branchId: "",
        role: "",
        status: "ACTIVE",
    });

    const [branches, setBranches] = useState<BranchResponse[]>([]);
    const [roles, setRoles] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            getBranches().then(res => setBranches(res.content)).catch(console.error);
            getSuperadminRoles().then(res => setRoles(res)).catch(console.error);
        }
    }, [isOpen]);

    useEffect(() => {
        if (userData) {
            setFormData({
                username: userData.username,
                name: userData.name,
                email: userData.email,
                branchId: userData.branchId,
                role: userData.roles[0] || "",
                status: userData.status,
            });
        }
    }, [userData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (userData?.id) {
            try {
                setIsSaving(true);
                await onSave(userData.id, {
                    name: formData.name,
                    email: formData.email,
                    branchId: formData.branchId,
                    roles: formData.role ? [formData.role] : [],
                    status: formData.status as "ACTIVE" | "INACTIVE"
                });
                onClose();
            } catch (error) {
                console.error("Failed to save user", error);
            } finally {
                setIsSaving(false);
            }
        } else {
            onClose();
        }
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
                    <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button type="submit" form={formId} variant="primary" disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save changes"}
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField
                    label="Username"
                    type="text"
                    required
                    value={formData.username}
                    disabled
                    onChange={() => {}} // Read-only
                />
                <InputField
                    label="Full Name"
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
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                >
                    <option value="">No Branch Assigned</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id.toString()}>{b.name}</option>
                    ))}
                </SelectField>

                <SelectField label="Role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                    <option value="">Select a role...</option>
                    {roles.map(r => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </SelectField>
            </form>
        </Modal>
    );
}
