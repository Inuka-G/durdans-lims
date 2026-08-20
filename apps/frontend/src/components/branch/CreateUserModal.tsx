"use client";

import { useId, useState } from "react";
import { Info, Save } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";
import StatusChip from "@/components/ui/StatusChip";
import { cn } from "@/lib/utils";

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreateUserModal({ isOpen, onClose }: CreateUserModalProps) {
    const [isAccountActive, setIsAccountActive] = useState(true);
    const [selectedRoles, setSelectedRoles] = useState<string[]>(["Phlebotomist", "MLT (Medical Lab Technician)", "Lab Supervisor"]);
    const statusLabelId = useId();
    const basicHeadingId = useId();
    const rolesHeadingId = useId();

    if (!isOpen) return null;

    const toggleRole = (role: string) => {
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
        "Lab Supervisor"
    ];

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Create new user"
            description="Add a new staff member to the Colombo branch."
            size="xl"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" icon={Save}>
                        Save user
                    </Button>
                </>
            }
        >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                {/* Left column - basic information */}
                <section aria-labelledby={basicHeadingId}>
                    <div className="mb-4 flex items-center gap-2">
                        <StatusChip tone="info" size="sm">Step 1</StatusChip>
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
                            placeholder="e.g. Dr. Maithree Perera"
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <InputField
                                label="Email address"
                                type="email"
                                name="email"
                                autoComplete="email"
                                placeholder="m.perera@durdans.com"
                            />
                            <InputField
                                label="Phone number"
                                type="tel"
                                name="phone"
                                autoComplete="tel"
                                placeholder="077 123 4567"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <InputField
                                label="Username"
                                type="text"
                                name="username"
                                autoComplete="username"
                                placeholder="mperera_lab"
                            />
                            <div className="min-w-0">
                                <span id={statusLabelId} className="mb-1 block text-xs font-medium text-fg-secondary">
                                    Account status
                                </span>
                                <div className="flex h-9 items-center justify-between gap-3 rounded-md border border-edge bg-surface px-3">
                                    <StatusChip tone={isAccountActive ? "success" : "neutral"} dot size="sm">
                                        {isAccountActive ? "Active" : "Disabled"}
                                    </StatusChip>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isAccountActive}
                                        aria-labelledby={statusLabelId}
                                        onClick={() => setIsAccountActive(!isAccountActive)}
                                        className={cn(
                                            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
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

                        <div className="flex items-start gap-2 rounded-md bg-primary-soft p-3" role="note">
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" aria-hidden="true" />
                            <p className="text-xs leading-relaxed text-fg-secondary">
                                An invitation email will be sent to the user to set their initial password after the account is created.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Right column - role assignment */}
                <section aria-labelledby={rolesHeadingId}>
                    <div className="mb-4 flex items-center gap-2">
                        <StatusChip tone="info" size="sm">Step 2</StatusChip>
                        <h3 id={rolesHeadingId} className="text-sm font-semibold text-fg">
                            Role assignment
                        </h3>
                    </div>

                    <fieldset>
                        <legend className="sr-only">Roles</legend>
                        <div className="space-y-2">
                            {roleOptions.map((role) => {
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
                </section>
            </div>
        </Modal>
    );
}
