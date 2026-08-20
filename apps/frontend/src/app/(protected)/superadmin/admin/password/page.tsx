"use client";

import { useId, useState, type ReactNode } from "react";
import { Info, KeyRound } from "lucide-react";
import DemoDataBanner from "@/components/shared/DemoDataBanner";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import StatusChip from "@/components/ui/StatusChip";
import Button from "@/components/ui/Button";
import { InputField } from "@/components/ui/Field";

const CHECKBOX_CLASS =
    "h-4 w-4 shrink-0 rounded border-edge-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface";

/** Small section heading inside a card body. */
function SubHeading({ children }: { children: ReactNode }) {
    return <h3 className="mb-3 text-xs font-semibold text-fg-secondary">{children}</h3>;
}

/** Labelled checkbox row for a character-composition rule. */
function RuleCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
    const id = useId();
    return (
        <label htmlFor={id} className="flex cursor-pointer items-center gap-3 text-sm text-fg">
            <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={CHECKBOX_CLASS} />
            {label}
        </label>
    );
}

// Static demo score shown in the strength ring (SVG circumference for r=56).
const STRENGTH_SCORE = 77;
const RING_CIRCUMFERENCE = 351.85;

export default function PasswordPolicyPage() {
    const [pwdConfig, setPwdConfig] = useState({
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecial: true,
        expiryDays: 90,
        historyCount: 5
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setIsSaving(false);
            console.log("Saved Password Policy Configuration", pwdConfig);
            // You could add a toast notification here
        }, 1200);
    };

    const ringOffset = RING_CIRCUMFERENCE * (1 - STRENGTH_SCORE / 100);

    return (
        <div className="mx-auto w-full max-w-6xl">
            <DemoDataBanner note="Demo screen — this password policy is a placeholder and is not applied to the identity provider." />

            <PageHeader
                crumbs={[{ label: "Super admin", href: "/superadmin" }, { label: "Password policy" }]}
                title="Global password policy"
                meta={<span>Character complexity rules and lifecycle constraints enforced across all hospital branches.</span>}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
                {/* Main Configuration Area */}
                <SectionCard
                    title="Password complexity rules"
                    actions={
                        <StatusChip tone="success" dot>
                            Active ruleset
                        </StatusChip>
                    }
                >
                    <div className="flex flex-col gap-6">
                        {/* Base Requirements */}
                        <div>
                            <SubHeading>Base requirements</SubHeading>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <InputField
                                    label="Minimum password length"
                                    type="number"
                                    min="8"
                                    max="64"
                                    inputMode="numeric"
                                    hint="Industry standard is 12 or more."
                                    value={pwdConfig.minLength}
                                    onChange={(e) => setPwdConfig({ ...pwdConfig, minLength: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        {/* Character Requirements */}
                        <fieldset>
                            <legend className="mb-3 text-xs font-semibold text-fg-secondary">Character composition</legend>
                            <div className="flex flex-col gap-3">
                                <RuleCheckbox
                                    label="Require uppercase letters (A–Z)"
                                    checked={pwdConfig.requireUppercase}
                                    onChange={(next) => setPwdConfig({ ...pwdConfig, requireUppercase: next })}
                                />
                                <RuleCheckbox
                                    label="Require lowercase letters (a–z)"
                                    checked={pwdConfig.requireLowercase}
                                    onChange={(next) => setPwdConfig({ ...pwdConfig, requireLowercase: next })}
                                />
                                <RuleCheckbox
                                    label="Require numbers (0–9)"
                                    checked={pwdConfig.requireNumbers}
                                    onChange={(next) => setPwdConfig({ ...pwdConfig, requireNumbers: next })}
                                />
                                <RuleCheckbox
                                    label="Require special characters (!@#$%)"
                                    checked={pwdConfig.requireSpecial}
                                    onChange={(next) => setPwdConfig({ ...pwdConfig, requireSpecial: next })}
                                />
                            </div>
                        </fieldset>

                        {/* Lifecycle */}
                        <div>
                            <SubHeading>Lifecycle and history</SubHeading>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <InputField
                                    label="Password expiration (days)"
                                    type="number"
                                    min="0"
                                    max="365"
                                    inputMode="numeric"
                                    hint="Set 0 to disable automatic expiration."
                                    value={pwdConfig.expiryDays}
                                    onChange={(e) => setPwdConfig({ ...pwdConfig, expiryDays: Number(e.target.value) })}
                                />
                                <InputField
                                    label="Prevent reuse limit (passwords)"
                                    type="number"
                                    min="0"
                                    max="24"
                                    inputMode="numeric"
                                    hint="Number of previous passwords remembered."
                                    value={pwdConfig.historyCount}
                                    onChange={(e) => setPwdConfig({ ...pwdConfig, historyCount: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* Right Sidebar - Contextual Info */}
                <div className="flex flex-col gap-4">
                    {/* Security Score */}
                    <SectionCard title="Password strength">
                        <div className="flex flex-col items-center">
                            <div
                                role="img"
                                aria-label={`Password strength score ${STRENGTH_SCORE} percent`}
                                className="relative flex h-32 w-32 items-center justify-center"
                            >
                                <svg viewBox="0 0 128 128" className="h-32 w-32 -rotate-90" aria-hidden="true">
                                    <circle cx="64" cy="64" r="56" fill="transparent" stroke="var(--surface-hover)" strokeWidth="12" />
                                    <circle
                                        cx="64"
                                        cy="64"
                                        r="56"
                                        fill="transparent"
                                        stroke="var(--color-status-verified)"
                                        strokeWidth="12"
                                        strokeDasharray={RING_CIRCUMFERENCE}
                                        strokeDashoffset={ringOffset}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <span className="absolute text-3xl font-semibold tabular-nums text-fg">
                                    {STRENGTH_SCORE}
                                    <span className="text-lg text-fg-muted">%</span>
                                </span>
                            </div>
                            <StatusChip tone="success" dot className="mt-4">
                                Adequate protection
                            </StatusChip>
                        </div>
                    </SectionCard>

                    {/* Information Box */}
                    <div role="note" className="flex items-start gap-3 rounded-lg border border-edge bg-primary-soft p-4">
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary-strong" aria-hidden="true" />
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-fg">Policy synchronisation</p>
                            <p className="mt-1 text-xs leading-relaxed text-fg-secondary">
                                Changes to password policies do not invalidate existing session tokens, but will be enforced the next time a
                                user changes their password.
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
                <Button variant="primary" icon={KeyRound} loading={isSaving} onClick={handleSave}>
                    {isSaving ? "Applying policies…" : "Save configuration"}
                </Button>
            </div>
        </div>
    );
}
