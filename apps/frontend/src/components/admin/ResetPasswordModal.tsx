"use client";

import { useId, useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";

interface ResetPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    userName: string;
    onConfirm: (userId: string, newPassword: string, adminUsername: string, adminPassword: string) => Promise<boolean>;
}

export default function ResetPasswordModal({ isOpen, onClose, userId, userName, onConfirm }: ResetPasswordModalProps) {
    const formId = useId();
    const [password, setPassword] = useState("admin");
    const [adminUsername, setAdminUsername] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setPassword("admin");
            setAdminUsername("");
            setAdminPassword("");
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;

        try {
            setIsSubmitting(true);
            const success = await onConfirm(userId, password, adminUsername, adminPassword);
            if (success) {
                onClose();
            }
        } catch (error) {
            console.error("Failed to reset password", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Reset User Password"
            description={`Are you sure you want to reset the password for ${userName}?`}
            size="sm"
            footer={
                <>
                    <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button type="submit" form={formId} variant="primary" disabled={isSubmitting}>
                        {isSubmitting ? "Resetting..." : "Reset Password"}
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
                <p className="text-sm text-slate-600">
                    This will invalidate their current password. They will be forced to change this temporary password upon their next login.
                </p>
                <InputField
                    label="Temporary Password"
                    required
                    type="text"
                    autoComplete="off"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                
                <hr className="my-2 border-slate-200" />
                
                <p className="text-sm font-medium text-slate-800">
                    Verify Your Identity
                </p>
                <InputField
                    label="Your Superadmin Username"
                    required
                    type="text"
                    autoComplete="off"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                />
                <InputField
                    label="Your Superadmin Password"
                    required
                    type="password"
                    autoComplete="new-password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                />
            </form>
        </Modal>
    );
}
