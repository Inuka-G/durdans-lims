"use client";

import { useMemo, useState } from "react";
import {
    ChevronDown,
    FileText,
    FlaskConical,
    Lock,
    RotateCcw,
    Save,
    Search,
    Settings2,
    ShieldCheck,
    X,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import StatusChip from "@/components/ui/StatusChip";

interface PermissionItem {
    id: string;
    name: string;
    description: string;
    /** Granted by default for this role. */
    granted: boolean;
    /** Required for the core role function — cannot be revoked. */
    locked?: boolean;
}

interface PermissionGroup {
    id: string;
    name: string;
    icon: LucideIcon;
    /** Declared permission count for the module (the preview lists a subset). */
    count: number;
    permissions: PermissionItem[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
    {
        id: "mlt",
        name: "MLT processing module",
        icon: FlaskConical,
        count: 8,
        permissions: [
            {
                id: "mlt.acknowledge",
                name: "Specimen acknowledgment",
                description: "Ability to confirm receipt of samples from phlebotomy or wards.",
                granted: true,
                locked: true,
            },
            {
                id: "mlt.results.enter",
                name: "Enter test results",
                description: "Manual entry and batch upload of analyzer results to the system.",
                granted: true,
            },
            {
                id: "mlt.results.edit",
                name: "Edit result history",
                description: "Modify existing result entries before final verification is locked.",
                granted: true,
            },
            {
                id: "mlt.flags.override",
                name: "Override abnormal flags",
                description: "Dismiss system-generated critical value alerts during data entry.",
                granted: false,
            },
        ],
    },
    { id: "verification", name: "Verification and authorisation", icon: ShieldCheck, count: 4, permissions: [] },
    { id: "qc", name: "QC and instrument maintenance", icon: Settings2, count: 12, permissions: [] },
    { id: "reporting", name: "Reporting and statistics", icon: FileText, count: 6, permissions: [] },
];

const DEFAULT_GRANTS: Record<string, boolean> = Object.fromEntries(
    PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.id, p.granted] as const))
);

export default function DetailedRolePermissionsPage() {
    // The MLT module starts expanded (was `isMLTModuleExpanded`); other groups start collapsed.
    const [expanded, setExpanded] = useState<Record<string, boolean>>({ mlt: true });
    const [grants, setGrants] = useState<Record<string, boolean>>(DEFAULT_GRANTS);
    const [search, setSearch] = useState("");

    const toggleGroup = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    const toggleGrant = (id: string) => setGrants((prev) => ({ ...prev, [id]: !prev[id] }));
    const resetToDefault = () => setGrants(DEFAULT_GRANTS);

    const isDirty = useMemo(() => PERMISSION_GROUPS.some((g) => g.permissions.some((p) => grants[p.id] !== p.granted)), [grants]);

    // Filter permissions by name/description; a matching group name keeps all of its permissions.
    const q = search.trim().toLowerCase();
    const visibleGroups = useMemo(() => {
        if (!q) return PERMISSION_GROUPS;
        return PERMISSION_GROUPS.map((g) => {
            if (g.name.toLowerCase().includes(q)) return g;
            const permissions = g.permissions.filter(
                (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
            );
            return { ...g, permissions };
        }).filter((g) => g.name.toLowerCase().includes(q) || g.permissions.length > 0);
    }, [q]);

    return (
        <div className="mx-auto w-full max-w-[1400px]">
            <PageHeader
                title="Medical laboratory technologist (MLT)"
                crumbs={[
                    { label: "System admin" },
                    { label: "Role permissions", href: "/superadmin/roles" },
                    { label: "Medical laboratory technologist" },
                ]}
                meta={
                    <>
                        <StatusChip tone="info" size="sm">
                            Core role
                        </StatusChip>
                        <span aria-hidden="true">·</span>
                        <span>Configure module-specific access for MLT staff</span>
                    </>
                }
                actions={
                    <label className="relative block w-full min-w-[220px] sm:w-80">
                        <span className="sr-only">Search permissions in this role</span>
                        <Search
                            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint"
                            aria-hidden="true"
                        />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search permissions in this role"
                            autoComplete="off"
                            className="h-9 w-full rounded-md border border-edge bg-surface pl-8 pr-8 text-sm text-fg placeholder:text-fg-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                aria-label="Clear search"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-muted hover:bg-surface-hover hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        )}
                    </label>
                }
            />

            <p role="status" aria-live="polite" className="sr-only">
                {q
                    ? `${visibleGroups.length} of ${PERMISSION_GROUPS.length} modules match "${search.trim()}".`
                    : isDirty
                      ? "Permissions changed. Save changes or reset to default."
                      : "Permissions match the role default."}
            </p>

            {visibleGroups.length === 0 ? (
                <section className="rounded-lg border border-edge bg-surface">
                    <EmptyState
                        icon={Search}
                        title="No permissions match"
                        description="Try a different permission or module name."
                        action={
                            <Button size="sm" icon={X} onClick={() => setSearch("")}>
                                Clear search
                            </Button>
                        }
                    />
                </section>
            ) : (
                <div className="space-y-3">
                    {visibleGroups.map((group) => {
                        const open = Boolean(expanded[group.id]);
                        const panelId = `permissions-${group.id}`;
                        const headingId = `${panelId}-heading`;
                        const Icon = group.icon;
                        return (
                            <section key={group.id} aria-labelledby={headingId} className="rounded-lg border border-edge bg-surface">
                                <h2 id={headingId} className="m-0">
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(group.id)}
                                        aria-expanded={open}
                                        aria-controls={panelId}
                                        className={cn(
                                            "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-surface-hover",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
                                            open && "rounded-b-none border-b border-edge bg-surface-muted"
                                        )}
                                    >
                                        <Icon className="h-5 w-5 shrink-0 text-fg-faint" aria-hidden="true" />
                                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{group.name}</span>
                                        <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[12px] font-medium tabular-nums text-fg-secondary">
                                            {group.count} {group.count === 1 ? "permission" : "permissions"}
                                        </span>
                                        <ChevronDown
                                            className={cn("h-4 w-4 shrink-0 text-fg-faint transition-transform", open && "rotate-180")}
                                            aria-hidden="true"
                                        />
                                    </button>
                                </h2>

                                {open && (
                                    <div id={panelId}>
                                        {group.permissions.length === 0 ? (
                                            <EmptyState
                                                compact
                                                icon={Lock}
                                                title="No permission details"
                                                description="This module's permissions aren't configurable from this view yet."
                                            />
                                        ) : (
                                            <ul className="grid grid-cols-1 gap-x-8 gap-y-1 p-3 md:grid-cols-2">
                                                {group.permissions.map((perm) => {
                                                    const checked = Boolean(grants[perm.id]);
                                                    const inputId = `perm-${perm.id.replace(/\W+/g, "-")}`;
                                                    const descId = `${inputId}-desc`;
                                                    return (
                                                        <li key={perm.id}>
                                                            <label
                                                                htmlFor={inputId}
                                                                className={cn(
                                                                    "flex items-start gap-3 rounded-md px-2 py-2 transition-colors",
                                                                    perm.locked ? "cursor-not-allowed" : "cursor-pointer hover:bg-surface-hover"
                                                                )}
                                                            >
                                                                <input
                                                                    id={inputId}
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    disabled={perm.locked}
                                                                    onChange={() => toggleGrant(perm.id)}
                                                                    aria-describedby={descId}
                                                                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-edge-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
                                                                />
                                                                <span className={cn("min-w-0", !checked && !perm.locked && "text-fg-secondary")}>
                                                                    <span className="flex items-center gap-1.5">
                                                                        <span className={cn("text-sm font-medium", checked ? "text-fg" : "text-fg-secondary")}>
                                                                            {perm.name}
                                                                        </span>
                                                                        {perm.locked && (
                                                                            <>
                                                                                <Lock className="h-3.5 w-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
                                                                                <span className="sr-only">(required for core role function)</span>
                                                                            </>
                                                                        )}
                                                                    </span>
                                                                    <span id={descId} className="mt-0.5 block text-xs leading-relaxed text-fg-muted">
                                                                        {perm.description}
                                                                        {perm.locked && " Required for the core role function."}
                                                                    </span>
                                                                </span>
                                                            </label>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            {/* Sticky action bar */}
            <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-edge bg-canvas py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                    <span>Version 2.4.1</span>
                    <span aria-hidden="true">·</span>
                    <span>
                        Last modified by <span className="font-medium text-fg-secondary">Admin_User</span> on 12 Oct, 11:20
                    </span>
                    {isDirty && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-status-pending-fg">Unsaved changes</span>
                        </>
                    )}
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Button icon={RotateCcw} onClick={resetToDefault} disabled={!isDirty}>
                        Reset to default
                    </Button>
                    <Button variant="primary" icon={Save}>
                        Save changes
                    </Button>
                </div>
            </div>
        </div>
    );
}
