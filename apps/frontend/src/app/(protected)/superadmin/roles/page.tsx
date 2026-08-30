"use client";

import { useId, useState, useMemo } from "react";
import { toast } from "sonner";
import {
    Boxes,
    Check,
    ClipboardCheck,
    FlaskConical,
    History,
    Minus,
    PackageCheck,
    ReceiptText,
    Save,
    Search,
    Send,
    Stethoscope,
    Syringe,
    User,
    X,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import EmptyState from "@/components/ui/EmptyState";
import DemoDataBanner from "@/components/shared/DemoDataBanner";
import { CONTROL_CLASS, SelectField } from "@/components/ui/Field";

// Types for Mock Data
type PermissionLevel = "checked" | "unchecked" | "dash";
type PermissionField = keyof Omit<ModulePermission, "module" | "icon">;

interface ModulePermission {
    module: string;
    icon: LucideIcon;
    view: PermissionLevel;
    create: PermissionLevel;
    edit: PermissionLevel;
    delete: PermissionLevel;
    approve: PermissionLevel;
    verify: PermissionLevel;
}

const PERMISSION_COLUMNS: { field: PermissionField; label: string }[] = [
    { field: "view", label: "View" },
    { field: "create", label: "Create" },
    { field: "edit", label: "Edit" },
    { field: "delete", label: "Delete" },
    { field: "approve", label: "Approve" },
    { field: "verify", label: "Verify" },
];

const roleProfiles: Record<string, ModulePermission[]> = {
    "Branch Administrator": [
        { module: "Patient Management", icon: User, view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "dash", verify: "dash" },
        { module: "Orders & Billing", icon: ReceiptText, view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "checked", verify: "dash" },
        { module: "Sample Collection", icon: Syringe, view: "checked", create: "checked", edit: "unchecked", delete: "unchecked", approve: "dash", verify: "dash" },
        { module: "Accessioning", icon: PackageCheck, view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "dash", verify: "dash" },
        { module: "MLT Processing", icon: FlaskConical, view: "checked", create: "unchecked", edit: "unchecked", delete: "unchecked", approve: "dash", verify: "dash" },
        { module: "Verification", icon: ClipboardCheck, view: "checked", create: "dash", edit: "unchecked", delete: "unchecked", approve: "dash", verify: "checked" },
        { module: "Report Dispatch", icon: Send, view: "checked", create: "unchecked", edit: "unchecked", delete: "unchecked", approve: "checked", verify: "dash" },
    ],
    "Pharmacist": [
        { module: "Patient Management", icon: User, view: "checked", create: "unchecked", edit: "unchecked", delete: "unchecked", approve: "dash", verify: "dash" },
        { module: "Orders & Billing", icon: ReceiptText, view: "checked", create: "unchecked", edit: "unchecked", delete: "unchecked", approve: "unchecked", verify: "dash" },
        { module: "Inventory", icon: Boxes, view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "unchecked", verify: "dash" },
    ],
    "Physician": [
        { module: "Patient Management", icon: User, view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "dash", verify: "dash" },
        { module: "Clinical History", icon: History, view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "dash", verify: "checked" },
        { module: "Prescriptions", icon: Stethoscope, view: "checked", create: "checked", edit: "checked", delete: "unchecked", approve: "dash", verify: "dash" },
    ]
};

export default function RolePermissionsPage() {
    const [selectedRole, setSelectedRole] = useState("Branch Administrator");
    const [searchQuery, setSearchQuery] = useState("");
    const [permissions, setPermissions] = useState<ModulePermission[]>(roleProfiles["Branch Administrator"]);
    const [isSaving, setIsSaving] = useState(false);
    const filterId = useId();

    // Filter permissions based on search query
    const filteredPermissions = useMemo(() => {
        return permissions.filter(p =>
            p.module.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [permissions, searchQuery]);

    // Nothing here is persisted (see the banner below) — but the in-progress
    // toggles are still real edits until a demo "save", so switching roles
    // out from under them without warning would still be a real data-loss bug.
    const isDirty = useMemo(
        () => JSON.stringify(permissions) !== JSON.stringify(roleProfiles[selectedRole] || []),
        [permissions, selectedRole]
    );

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRole = e.target.value;
        if (isDirty && !window.confirm(`Discard unsaved permission changes for ${selectedRole}?`)) {
            return;
        }
        setSelectedRole(newRole);
        // Load the profile for the selected role
        setPermissions(roleProfiles[newRole] || []);
        setSearchQuery(""); // Reset search when switching roles
    };

    const handleSave = async () => {
        setIsSaving(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success(`Permissions saved for ${selectedRole}`);
        setIsSaving(false);
    };

    const togglePermission = (moduleName: string, field: PermissionField) => {
        setPermissions(prev => prev.map(item => {
            if (item.module === moduleName) {
                const currentVal = item[field];
                if (currentVal === "dash") return item; // Cannot toggle dashed items
                return {
                    ...item,
                    [field]: currentVal === "checked" ? "unchecked" : "checked"
                };
            }
            return item;
        }));
    };

    /** One cell of the matrix: an accessible checkbox, or "not applicable" for dashed items. */
    const renderCheckbox = (val: PermissionLevel, label: string, onClick: () => void) => {
        if (val === "dash") {
            return (
                <span className="inline-flex h-5 w-5 items-center justify-center text-fg-faint" title="Not applicable">
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">{label}: not applicable</span>
                </span>
            );
        }

        const checked = val === "checked";
        return (
            <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={label}
                onClick={onClick}
                className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded border transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
                    checked
                        ? "border-primary bg-primary text-white hover:bg-primary-strong"
                        : "border-edge-strong bg-surface hover:border-primary"
                )}
            >
                {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
            </button>
        );
    };

    return (
        <div className="mx-auto w-full max-w-[1280px]">
            <PageHeader
                title="Role permission matrix"
                crumbs={[{ label: "System" }, { label: "Global administration" }, { label: "Role definitions" }]}
                meta={<span>Configure module access for each system role</span>}
                actions={
                    <Button variant="primary" icon={Save} onClick={handleSave} loading={isSaving}>
                        {isSaving ? "Saving…" : "Save changes"}
                    </Button>
                }
            />

            <DemoDataBanner note="Demo data — this permission matrix is not yet wired to a backend; nothing you change or “save” here is persisted." />

            <p role="status" aria-live="polite" className="sr-only">
                {isSaving
                    ? `Saving permissions for ${selectedRole}`
                    : `${selectedRole}: ${filteredPermissions.length} of ${permissions.length} modules shown.`}
            </p>

            <SectionCard title="Module permissions" count={filteredPermissions.length} flush>
                {/* Controls */}
                <div className="flex flex-wrap items-end gap-3 border-b border-edge bg-surface-muted px-3 py-2.5">
                    <SelectField label="Role" value={selectedRole} onChange={handleRoleChange} className="w-full sm:w-60">
                        {Object.keys(roleProfiles).map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </SelectField>

                    <div className="w-full sm:ml-auto sm:w-64">
                        <label htmlFor={filterId} className="mb-1 block text-xs font-medium text-fg-secondary">
                            Filter modules
                        </label>
                        {/* Composed inline (not InputField) so the input itself reserves room for the clear button. */}
                        <div className="relative">
                            <input
                                id={filterId}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Filter by module name"
                                autoComplete="off"
                                className={cn(CONTROL_CLASS, "h-9 pr-8")}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    aria-label="Clear filter"
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-fg-muted hover:bg-surface-hover hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Permission matrix */}
                {filteredPermissions.length === 0 ? (
                    <EmptyState
                        icon={Search}
                        title="No modules match"
                        description="Try a different module name."
                        action={
                            <Button size="sm" icon={X} onClick={() => setSearchQuery("")}>
                                Clear filter
                            </Button>
                        }
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px] table-fixed text-left text-sm">
                            <caption className="sr-only">Permissions for {selectedRole} by module and action</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                    <th scope="col" className="w-56 py-2 pl-4 pr-3 font-semibold">
                                        System module
                                    </th>
                                    {PERMISSION_COLUMNS.map((col) => (
                                        <th key={col.field} scope="col" className="px-3 py-2 text-center font-semibold">
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {filteredPermissions.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <tr key={item.module} className="transition-colors hover:bg-surface-hover">
                                            <th scope="row" className="py-2 pl-4 pr-3 font-medium text-fg">
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <Icon className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                                                    <span className="truncate" title={item.module}>{item.module}</span>
                                                </span>
                                            </th>
                                            {PERMISSION_COLUMNS.map((col) => (
                                                <td key={col.field} className="px-3 py-2 text-center">
                                                    <span className="inline-flex justify-center align-middle">
                                                        {renderCheckbox(item[col.field], `${col.label} ${item.module}`, () =>
                                                            togglePermission(item.module, col.field)
                                                        )}
                                                    </span>
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-edge px-4 py-2 text-xs text-fg-muted">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-primary text-white" aria-hidden="true">
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                        Granted
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-3.5 w-3.5 rounded-sm border border-edge-strong bg-surface" aria-hidden="true" />
                        Not granted
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <Minus className="h-3.5 w-3.5 text-fg-faint" aria-hidden="true" />
                        Not applicable
                    </span>
                </div>
            </SectionCard>
        </div>
    );
}
