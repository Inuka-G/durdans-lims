"use client";

import { useState, useEffect, useId } from "react";
import { Check, Save } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";
import StatusChip from "@/components/ui/StatusChip";
import { cn } from "@/lib/utils";

interface ViewEditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'view' | 'edit';
    userData: {
        id: string;
        fullName: string;
        email: string;
        roles: string[];
        status: "ACTIVE" | "DISABLED";
        phone?: string;
        username?: string;
    } | null;
    onSave?: (updatedData: any) => void;
}

export default function ViewEditUserModal({ isOpen, onClose, mode, userData, onSave }: ViewEditUserModalProps) {
    const [isAccountActive, setIsAccountActive] = useState(true);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: "+94 77 123 4567", // Mock default
        username: "",
    });
    const statusLabelId = useId();
    const basicHeadingId = useId();
    const rolesHeadingId = useId();

    useEffect(() => {
        if (userData && isOpen) {
            setIsAccountActive(userData.status === 'ACTIVE');
            setSelectedRoles(userData.roles || []);
            setFormData({
                fullName: userData.fullName || "",
                email: userData.email || "",
                phone: userData.phone || "+94 77 123 4567",
                username: userData.username || userData.email.split('@')[0],
            });
        }
    }, [userData, isOpen]);

    if (!isOpen || !userData) return null;

    const isEdit = mode === 'edit';

    const toggleRole = (role: string) => {
        if (!isEdit) return;
        setSelectedRoles(prev =>
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        );
    };

    const roleOptions = [
        "Front Desk Officer",
        "Billing Officer",
        "Phlebotomist",
        "Lab Receptionist",
        "MLT (Medical Lab Technician)",
        "Lab Supervisor",
        "Senior Pathologist",
        "Branch Head",
        "Data Entry Clerk"
    ];

    const handleSave = () => {
        if (onSave) {
            onSave({
                ...userData,
                ...formData,
                roles: selectedRoles,
                status: isAccountActive ? 'ACTIVE' : 'DISABLED'
            });
        }
        onClose();
    };

    const visibleRoles = isEdit ? roleOptions : roleOptions.filter((role) => selectedRoles.includes(role));
    // View mode: read-only inputs sit on the muted surface so they read as values, not editable fields.
    const readOnlyField = isEdit ? undefined : "[&>input]:bg-surface-muted [&>input]:cursor-default";

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={isEdit ? "Edit user details" : "User profile"}
            description={isEdit ? `Modifying settings for ${userData.id}` : `Viewing information for ${userData.id}`}
            size="xl"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        {isEdit ? "Cancel" : "Close"}
                    </Button>
                    {isEdit && (
                        <Button variant="primary" icon={Save} onClick={handleSave}>
                            Save changes
                        </Button>
                    )}
                </>
            }
        >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                {/* Left column - basic information */}
                <section aria-labelledby={basicHeadingId}>
                    <div className="mb-4 flex items-center gap-2">
                        <StatusChip tone="info" size="sm">Info</StatusChip>
                        <h3 id={basicHeadingId} className="text-sm font-semibold text-fg">
                            Basic information
                        </h3>
                    </div>

                    <div className="space-y-4">
                        <InputField
                            label="Full name"
                            type="text"
                            name="fullName"
                            autoComplete="name"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            readOnly={!isEdit}
                            className={readOnlyField}
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <InputField
                                label="Email address"
                                type="email"
                                name="email"
                                autoComplete="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                readOnly={!isEdit}
                                className={readOnlyField}
                            />
                            <InputField
                                label="Phone number"
                                type="tel"
                                name="phone"
                                autoComplete="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                readOnly={!isEdit}
                                className={readOnlyField}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <InputField
                                label="Username"
                                type="text"
                                name="username"
                                value={formData.username}
                                readOnly
                                hint={isEdit ? "Username can't be changed" : undefined}
                                className={cn(readOnlyField, isEdit && "[&>input]:bg-surface-muted [&>input]:text-fg-muted [&>input]:cursor-not-allowed")}
                            />
                            <div className="min-w-0">
                                <span id={statusLabelId} className="mb-1 block text-xs font-medium text-fg-secondary">
                                    Account status
                                </span>
                                <div
                                    className={cn(
                                        "flex h-9 items-center justify-between gap-3 rounded-md border border-edge px-3",
                                        isEdit ? "bg-surface" : "bg-surface-muted"
                                    )}
                                >
                                    <StatusChip tone={isAccountActive ? "success" : "neutral"} dot size="sm">
                                        {isAccountActive ? "Active" : "Disabled"}
                                    </StatusChip>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isAccountActive}
                                        aria-labelledby={statusLabelId}
                                        onClick={() => setIsAccountActive(!isAccountActive)}
                                        disabled={!isEdit}
                                        className={cn(
                                            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
                                            "disabled:cursor-default disabled:opacity-60",
                                            isAccountActive ? "bg-primary" : "bg-edge-strong"
                                        )}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                "pointer-events-none inline-block h-4 w-4 rounded-full bg-surface dark:bg-fg ring-1 ring-edge-strong transition-transform",
                                                isAccountActive ? "translate-x-[18px]" : "translate-x-0.5"
                                            )}
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Right column - role assignment */}
                <section aria-labelledby={rolesHeadingId}>
                    <div className="mb-4 flex items-center gap-2">
                        <StatusChip tone="info" size="sm">Access</StatusChip>
                        <h3 id={rolesHeadingId} className="text-sm font-semibold text-fg">
                            Role assignment
                        </h3>
                    </div>

                    {isEdit ? (
                        <fieldset>
                            <legend className="sr-only">Roles</legend>
                            <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
                                {visibleRoles.map((role) => {
                                    const isSelected = selectedRoles.includes(role);
                                    return (
                                        <label
                                            key={role}
                                            className={cn(
                                                "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
                                                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-surface",
                                                isSelected
                                                    ? "border-primary bg-primary-soft text-fg"
                                                    : "border-edge bg-surface text-fg-secondary hover:bg-surface-hover hover:border-edge-strong"
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleRole(role)}
                                                className="h-4 w-4 shrink-0 rounded border-edge-strong accent-primary focus:outline-none"
                                            />
                                            <span className="font-medium">{role}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                    ) : visibleRoles.length === 0 ? (
                        <p className="rounded-md border border-dashed border-edge px-3 py-4 text-center text-xs text-fg-muted">
                            No roles assigned
                        </p>
                    ) : (
                        <ul className="max-h-[400px] space-y-2 overflow-y-auto pr-1" aria-label="Assigned roles">
                            {visibleRoles.map((role) => (
                                <li
                                    key={role}
                                    className="flex items-center gap-3 rounded-md border border-edge bg-surface-muted px-3 py-2.5 text-sm text-fg"
                                >
                                    <Check className="h-4 w-4 shrink-0 text-primary-strong" aria-hidden="true" />
                                    <span className="font-medium">{role}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </Modal>
    );
}
