"use client";

import { useId, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Info, Mail, MessageSquare, QrCode, ShieldCheck } from "lucide-react";
import DemoDataBanner from "@/components/shared/DemoDataBanner";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import StatusChip from "@/components/ui/StatusChip";
import Button from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

const CHECKBOX_CLASS =
    "h-4 w-4 shrink-0 rounded border-edge-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50";

/** Small section heading inside a card body. */
function SubHeading({ children }: { children: ReactNode }) {
    return <h3 className="mb-3 text-xs font-semibold text-fg-secondary">{children}</h3>;
}

/** Checkbox row for an allowed verification method. */
function MethodRow({
    icon: Icon,
    title,
    description,
    checked,
    onChange,
    badge,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    checked: boolean;
    onChange: (next: boolean) => void;
    badge?: ReactNode;
}) {
    const id = useId();
    return (
        <label
            htmlFor={id}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-edge bg-surface px-3 py-2.5 transition-colors hover:bg-surface-hover"
        >
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className={CHECKBOX_CLASS}
            />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
                <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-fg">{title}</span>
                <span className="text-xs text-fg-muted">{description}</span>
            </span>
            {badge}
        </label>
    );
}

/** Horizontal adoption meter with an accessible progressbar role. */
function AdoptionMeter({ label, value, tone }: { label: string; value: number; tone: "primary" | "pending" }) {
    const labelId = useId();
    return (
        <div>
            <div className="mb-1.5 flex items-end justify-between gap-2">
                <span id={labelId} className="text-sm font-medium text-fg-secondary">
                    {label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-fg">{value}%</span>
            </div>
            <div
                role="progressbar"
                aria-labelledby={labelId}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
                className="h-2 w-full overflow-hidden rounded-full bg-surface-hover"
            >
                <div
                    className={cn("h-full rounded-full", tone === "primary" ? "bg-primary" : "bg-status-pending")}
                    style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                />
            </div>
        </div>
    );
}

export default function TwoFactorPolicyPage() {
    const [tfaConfig, setTfaConfig] = useState({
        globalEnforce: false,
        enforceAdminOnly: true,
        allowAuthenticator: true,
        allowSMS: false,
        allowEmail: true,
        sessionTimeout: 15
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            console.log("Saved 2FA Policy Configuration", tfaConfig);
        }, 1200);
    };

    const globalLabelId = useId();
    const globalDescId = useId();
    const adminOnlyId = useId();
    const adminOnlyDescId = useId();

    return (
        <div className="mx-auto w-full max-w-6xl">
            <DemoDataBanner note="Demo screen — these MFA settings are placeholders and are not saved to the identity provider." />

            <PageHeader
                crumbs={[{ label: "Super admin", href: "/superadmin" }, { label: "Two-factor authentication" }]}
                title="Global 2FA policy"
                meta={<span>Define active enforcement zones and permitted alternative verification methods.</span>}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
                {/* Main Configuration Area */}
                <SectionCard
                    title="2FA enforcement rules"
                    actions={
                        <StatusChip tone="success" dot>
                            Active ruleset
                        </StatusChip>
                    }
                >
                    <div className="flex flex-col gap-6">
                        {/* Enforcement */}
                        <div>
                            <SubHeading>Enforcement level</SubHeading>

                            <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-edge bg-surface-muted px-3 py-2.5">
                                <div className="min-w-0">
                                    <p id={globalLabelId} className="text-sm font-medium text-fg">
                                        Global enforce 2FA
                                    </p>
                                    <p id={globalDescId} className="mt-0.5 text-xs text-fg-muted">
                                        Require 2FA for all users across all branches.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={tfaConfig.globalEnforce}
                                    aria-labelledby={globalLabelId}
                                    aria-describedby={globalDescId}
                                    onClick={() => setTfaConfig(p => ({ ...p, globalEnforce: !p.globalEnforce }))}
                                    className={cn(
                                        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
                                        tfaConfig.globalEnforce ? "bg-primary" : "bg-fg-muted"
                                    )}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-surface ring-1 ring-edge transition-transform",
                                            tfaConfig.globalEnforce ? "translate-x-[18px]" : "translate-x-0.5"
                                        )}
                                    />
                                </button>
                            </div>

                            <label
                                htmlFor={adminOnlyId}
                                className={cn(
                                    "flex items-center justify-between gap-3 rounded-md border border-edge px-3 py-2.5 transition-colors",
                                    tfaConfig.globalEnforce ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-surface-hover"
                                )}
                            >
                                <span className="flex min-w-0 flex-col">
                                    <span className="text-sm font-medium text-fg">Enforce for administrators only</span>
                                    <span id={adminOnlyDescId} className="text-xs text-fg-muted">
                                        Only require 2FA for branch admins, department heads and super admins.
                                    </span>
                                </span>
                                <input
                                    id={adminOnlyId}
                                    type="checkbox"
                                    className={cn(CHECKBOX_CLASS, "h-5 w-5")}
                                    checked={tfaConfig.enforceAdminOnly}
                                    disabled={tfaConfig.globalEnforce}
                                    aria-describedby={adminOnlyDescId}
                                    onChange={(e) => setTfaConfig({ ...tfaConfig, enforceAdminOnly: e.target.checked })}
                                />
                            </label>
                        </div>

                        {/* Allowed Methods */}
                        <div>
                            <SubHeading>Allowed methods</SubHeading>
                            <div className="flex flex-col gap-2">
                                <MethodRow
                                    icon={QrCode}
                                    title="Authenticator app (TOTP)"
                                    description="Google Authenticator, Authy, etc."
                                    checked={tfaConfig.allowAuthenticator}
                                    onChange={(next) => setTfaConfig({ ...tfaConfig, allowAuthenticator: next })}
                                    badge={
                                        <StatusChip tone="success" size="sm">
                                            Recommended
                                        </StatusChip>
                                    }
                                />
                                <MethodRow
                                    icon={MessageSquare}
                                    title="SMS verification"
                                    description="Sends a 6-digit code via text message."
                                    checked={tfaConfig.allowSMS}
                                    onChange={(next) => setTfaConfig({ ...tfaConfig, allowSMS: next })}
                                />
                                <MethodRow
                                    icon={Mail}
                                    title="Email verification"
                                    description="Sends a verification link to the registered email."
                                    checked={tfaConfig.allowEmail}
                                    onChange={(next) => setTfaConfig({ ...tfaConfig, allowEmail: next })}
                                />
                            </div>
                        </div>

                        {/* Settings */}
                        <div>
                            <SubHeading>Timeout settings</SubHeading>
                            <InputField
                                label="Remember device for (days)"
                                type="number"
                                min="0"
                                max="60"
                                inputMode="numeric"
                                className="max-w-[240px]"
                                value={tfaConfig.sessionTimeout}
                                onChange={(e) => setTfaConfig({ ...tfaConfig, sessionTimeout: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                </SectionCard>

                {/* Right Sidebar - Contextual Info */}
                <div className="flex flex-col gap-4">
                    {/* Usage Stats (Specific to 2FA) */}
                    <SectionCard title="2FA adoption metrics">
                        <div className="space-y-5">
                            <AdoptionMeter label="Admin adoption" value={100} tone="primary" />
                            <div>
                                <AdoptionMeter label="General staff adoption" value={42} tone="pending" />
                                <p className="mt-2 text-xs leading-snug text-fg-muted">
                                    Consider enabling &quot;Global enforce&quot; to drive complete adoption across all branches.
                                </p>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Information Box */}
                    <div role="note" className="flex items-start gap-3 rounded-lg border border-edge bg-primary-soft p-4">
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary-strong" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-fg">Policy synchronisation</p>
                            <p className="mt-1 text-xs leading-relaxed text-fg-secondary">
                                2FA enforcements take immediate effect and may terminate active workflow sessions for non-compliant users.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-between gap-3 border-t border-edge bg-canvas py-3">
                <div role="status" aria-live="polite" className="min-w-0 text-xs text-fg-muted">
                    {isSaving && <span className="font-medium text-fg-secondary">Applying policies…</span>}
                </div>
                <Button variant="primary" icon={ShieldCheck} loading={isSaving} onClick={handleSave}>
                    {isSaving ? "Applying policies…" : "Save 2FA policy"}
                </Button>
            </div>
        </div>
    );
}
