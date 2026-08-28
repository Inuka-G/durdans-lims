"use client";

import { useId, useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { createAdminUser, getBranches, getSuperadminRoles, BranchResponse } from "@/lib/api";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { InputField, SelectField } from "@/components/ui/Field";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UserCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type UserStatus = "ACTIVE" | "INACTIVE";

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
];

export default function UserCreateModal({ isOpen, onClose }: UserCreateModalProps) {
    const { user: authUser } = useAuth();
    const formId = useId();
    const [formData, setFormData] = useState({
        username: "",
        name: "",
        email: "",
        branch: "",
        role: "",
        status: "ACTIVE",
    });
    
    const [roles, setRoles] = useState<string[]>([]);
    const [branches, setBranches] = useState<BranchResponse[]>([]);
    
    useEffect(() => {
        if (isOpen) {
            getSuperadminRoles().then(setRoles).catch(console.error);
            getBranches(0, 1000).then((res) => {
                setBranches(res.content);
                if (res.content.length > 0 && !formData.branch) {
                    setFormData(prev => ({ ...prev, branch: res.content[0].code }));
                }
            }).catch(console.error);
            
            // Set initial role if loaded
            getSuperadminRoles().then(r => {
               if (r.length > 0 && !formData.role) {
                   setFormData(prev => ({ ...prev, role: r[0] }));
               }
            }).catch(console.error);
        }
    }, [isOpen]);
    
    const [adminUsername, setAdminUsername] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!authUser?.preferred_username) {
            setError("Unable to identify current admin session.");
            return;
        }

        const expectedUsername = authUser.preferred_username.trim().toLowerCase();
        const providedUsername = adminUsername.trim().toLowerCase();

        if (providedUsername !== expectedUsername) {
            setError("Username does not match your active session.");
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const trimmed = formData.name.trim();
            const sp = trimmed.indexOf(" ");
            const firstName = sp === -1 ? trimmed : trimmed.slice(0, sp);
            const lastName = sp === -1 ? "" : trimmed.slice(sp + 1);
            await createAdminUser({
                username: formData.username.trim() || formData.email.split("@")[0],
                email: formData.email,
                firstName,
                lastName,
                role: formData.role, // Pass exactly as retrieved from API
                branchCode: formData.branch,
                adminPassword: adminPassword,
            });
            onClose();
            toast.success(`User '${firstName} ${lastName}' created successfully!`, { position: 'top-right' });
        } catch (err: any) {
            if (err?.response?.data?.message?.includes("Incorrect admin password") || err?.response?.status === 401 || err?.response?.status === 400) {
                setError("Incorrect admin password. Verification failed.");
            } else {
                setError(err?.response?.data?.message || err.message || "Failed to create user. Ensure the Keycloak admin module is enabled and the role/branch are valid.");
            }
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
                        className="flex items-start gap-2 rounded-md bg-status-danger-bg px-3 py-2 text-[13px] text-status-danger-fg ring-1 ring-inset ring-status-danger-edge sm:col-span-2"
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
                    label="Username"
                    required
                    type="text"
                    placeholder="e.g. janedoe"
                    autoComplete="off"
                    className="sm:col-span-2"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
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

                <SelectField
                    label="Branch"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                >
                    <option value="" disabled>Select a branch</option>
                    {branches.map(b => (
                        <option key={b.code} value={b.code} disabled={b.status !== 'Active'}>{b.name}{b.status !== 'Active' ? ' (Inactive)' : ''}</option>
                    ))}
                </SelectField>

                <SelectField label="Role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                    <option value="" disabled>Select a role</option>
                    {roles.map(r => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </SelectField>

                <div className="sm:col-span-2">
                    <p className="mb-1 text-xs font-medium text-fg-secondary">Initial status</p>
                    <SegmentedControl<UserStatus>
                        ariaLabel="Initial status"
                        value={formData.status as UserStatus}
                        onChange={(next) => setFormData({ ...formData, status: next })}
                        options={STATUS_OPTIONS}
                    />
                </div>
                
                <hr className="sm:col-span-2 my-2 border-slate-200" />
                
                <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-slate-800 mb-2">
                        Verify Your Identity
                    </p>
                </div>
                
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
