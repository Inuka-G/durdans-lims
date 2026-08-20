"use client";

import { useId, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, KeyRound, Save, ShieldCheck, UserCog } from "lucide-react";
import DemoDataBanner from "@/components/shared/DemoDataBanner";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";
import SegmentedControl from "@/components/ui/SegmentedControl";
import StatusChip from "@/components/ui/StatusChip";
import Button from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

type SecurityTab = "idp" | "mfa" | "password";

const TAB_OPTIONS: { value: SecurityTab; label: string }[] = [
    { value: "idp", label: "Identity provider" },
    { value: "mfa", label: "MFA and OTP rules" },
    { value: "password", label: "Password policies" },
];

const CHECKBOX_CLASS =
    "h-4 w-4 shrink-0 rounded border-edge-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface";

const RANGE_CLASS =
    "w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** A labelled on/off row rendered as an accessible switch. */
function ToggleRow({
    title,
    description,
    checked,
    onChange,
    icon: Icon,
}: {
    title: string;
    description?: string;
    checked: boolean;
    onChange: () => void;
    icon?: LucideIcon;
}) {
    const labelId = useId();
    const descId = useId();
    return (
        <div className="flex items-center justify-between gap-3 rounded-md border border-edge bg-surface-muted px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
                {Icon && (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                )}
                <div className="min-w-0">
                    <p id={labelId} className="text-sm font-medium text-fg">
                        {title}
                    </p>
                    {description && (
                        <p id={descId} className="mt-0.5 text-xs text-fg-muted">
                            {description}
                        </p>
                    )}
                </div>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-labelledby={labelId}
                aria-describedby={description ? descId : undefined}
                onClick={onChange}
                className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
                    checked ? "bg-primary" : "bg-fg-muted"
                )}
            >
                <span
                    aria-hidden="true"
                    className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-surface ring-1 ring-edge transition-transform",
                        checked ? "translate-x-[18px]" : "translate-x-0.5"
                    )}
                />
            </button>
        </div>
    );
}

/** Sticky footer holding a panel's actions (secondary on the left of the primary). */
function ActionBar({ children }: { children: ReactNode }) {
    return (
        <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-end gap-2 border-t border-edge bg-canvas py-3">
            {children}
        </div>
    );
}

export default function SecurityConfigurationPage() {
    const [activeTab, setActiveTab] = useState<SecurityTab>("idp");

    // MOCK STATES FOR TOGGLES
    const [centralizedAuth, setCentralizedAuth] = useState(true);
    const [ssoEnabled, setSsoEnabled] = useState(true);
    const [tokenEncryption, setTokenEncryption] = useState(true);

    const [requireMfaSuperAdmin, setRequireMfaSuperAdmin] = useState(true);
    const [requireMfaBranchAdmin, setRequireMfaBranchAdmin] = useState(false);

    const [requireSpecialChar, setRequireSpecialChar] = useState(true);
    const [requireUppercase, setRequireUppercase] = useState(true);
    const [requireNumber, setRequireNumber] = useState(true);

    // Display-only values for the range sliders (previously static labels).
    const [otpLength, setOtpLength] = useState(6);
    const [minPasswordLength, setMinPasswordLength] = useState(12);

    const otpLengthId = useId();
    const minLengthId = useId();
    const uppercaseId = useId();
    const numberId = useId();
    const specialId = useId();

    return (
        <div className="mx-auto w-full max-w-6xl">
            <DemoDataBanner note="Demo console — these security toggles are placeholders and do not change live auth policy." />

            <PageHeader
                crumbs={[{ label: "Super admin", href: "/superadmin" }, { label: "Security" }]}
                title="Security configuration"
                meta={<span>Identity provider, multi-factor authentication and password policies for every branch.</span>}
            />

            <div className="mb-4">
                <SegmentedControl<SecurityTab>
                    ariaLabel="Security settings section"
                    value={activeTab}
                    onChange={setActiveTab}
                    options={TAB_OPTIONS}
                />
            </div>

            {/* IDP Tab */}
            {activeTab === "idp" && (
                <div className="space-y-4">
                    <div
                        role="note"
                        className="flex items-start gap-2 rounded-md border border-status-pending-edge bg-status-pending-bg px-4 py-2.5 text-[13px] text-status-pending-fg"
                    >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>
                            <span className="font-medium">Caution:</span> changes to identity provider settings may require active users to
                            re-authenticate.
                        </span>
                    </div>

                    <SectionCard
                        title="Keycloak identity provider"
                        actions={
                            <StatusChip tone="success" dot>
                                Connected
                            </StatusChip>
                        }
                    >
                        <p className="mb-4 text-xs text-fg-muted">Global configuration for centralised authentication and token management.</p>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            {/* Core Toggles */}
                            <div className="space-y-3">
                                <ToggleRow
                                    title="Centralised authentication"
                                    description="Require all users to verify identity against the central Keycloak database."
                                    checked={centralizedAuth}
                                    onChange={() => setCentralizedAuth(!centralizedAuth)}
                                />
                                <ToggleRow
                                    title="Single sign-on (SSO)"
                                    description="Log in once to access sample collection, testing and billing modules."
                                    checked={ssoEnabled}
                                    onChange={() => setSsoEnabled(!ssoEnabled)}
                                />
                                <ToggleRow
                                    title="Enforce JWT encryption"
                                    description="Ensure token signatures are encrypted across all microservices."
                                    checked={tokenEncryption}
                                    onChange={() => setTokenEncryption(!tokenEncryption)}
                                />
                            </div>

                            {/* Connection Details */}
                            <div className="space-y-4">
                                <InputField label="Keycloak server URL" type="text" defaultValue="https://auth.laboratory-erp.com/auth" autoComplete="off" />
                                <InputField label="Realm name" type="text" defaultValue="LIMS-Global-Realm" autoComplete="off" />
                                <InputField label="Admin client ID" type="text" defaultValue="lims-superadmin-cli" autoComplete="off" />
                                <InputField label="Admin client secret" type="password" defaultValue="************************" autoComplete="off" />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Token lifespan">
                        <p className="mb-4 text-xs text-fg-muted">Manage expiration durations for security tokens.</p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <InputField label="Access token (minutes)" type="number" defaultValue={15} inputMode="numeric" />
                            <InputField label="Refresh token (hours)" type="number" defaultValue={24} inputMode="numeric" />
                            <InputField label="SSO session idle (minutes)" type="number" defaultValue={30} inputMode="numeric" />
                            <InputField label="SSO session max (hours)" type="number" defaultValue={10} inputMode="numeric" />
                        </div>
                    </SectionCard>

                    <ActionBar>
                        <Button variant="secondary">Discard changes</Button>
                        <Button variant="primary" icon={Save}>
                            Save IDP config
                        </Button>
                    </ActionBar>
                </div>
            )}

            {/* MFA Tab */}
            {activeTab === "mfa" && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {/* Role Based MFA */}
                        <SectionCard title="Role requirements">
                            <p className="mb-4 text-xs text-fg-muted">
                                Configure multi-factor authentication requirements globally and for specific roles.
                            </p>
                            <div className="space-y-3">
                                <ToggleRow
                                    icon={ShieldCheck}
                                    title="Super administrator"
                                    description="Mandatory authenticator app"
                                    checked={requireMfaSuperAdmin}
                                    onChange={() => setRequireMfaSuperAdmin(!requireMfaSuperAdmin)}
                                />
                                <ToggleRow
                                    icon={UserCog}
                                    title="Branch administrator"
                                    description="Mandatory authenticator app"
                                    checked={requireMfaBranchAdmin}
                                    onChange={() => setRequireMfaBranchAdmin(!requireMfaBranchAdmin)}
                                />
                            </div>
                        </SectionCard>

                        {/* OTP Configuration */}
                        <SectionCard title="OTP generation rules">
                            <div className="space-y-5">
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <label htmlFor={otpLengthId} className="text-xs font-medium text-fg-secondary">
                                            OTP length
                                        </label>
                                        <span className="text-xs font-medium tabular-nums text-primary-strong" aria-live="polite">
                                            {otpLength} digits
                                        </span>
                                    </div>
                                    <input
                                        id={otpLengthId}
                                        type="range"
                                        min="4"
                                        max="8"
                                        step="1"
                                        value={otpLength}
                                        onChange={(e) => setOtpLength(Number(e.target.value))}
                                        aria-valuetext={`${otpLength} digits`}
                                        className={RANGE_CLASS}
                                    />
                                    <div className="mt-1 flex justify-between text-[11px] tabular-nums text-fg-faint" aria-hidden="true">
                                        <span>4</span>
                                        <span>8</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <InputField label="Expiration (minutes)" type="number" defaultValue="5" inputMode="numeric" />
                                    <InputField label="Max retry attempts" type="number" defaultValue="3" inputMode="numeric" />
                                </div>
                            </div>
                        </SectionCard>
                    </div>

                    <ActionBar>
                        <Button variant="primary" icon={ShieldCheck}>
                            Enforce MFA policies
                        </Button>
                    </ActionBar>
                </div>
            )}

            {/* Password Tab */}
            {activeTab === "password" && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Complexity */}
                        <SectionCard title="Complexity rules">
                            <p className="mb-4 text-xs text-fg-muted">Global requirements for password complexity.</p>
                            <div className="space-y-4">
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <label htmlFor={minLengthId} className="text-xs font-medium text-fg-secondary">
                                            Minimum length
                                        </label>
                                        <span className="text-xs font-medium tabular-nums text-primary-strong" aria-live="polite">
                                            {minPasswordLength} characters
                                        </span>
                                    </div>
                                    <input
                                        id={minLengthId}
                                        type="range"
                                        min="8"
                                        max="24"
                                        step="1"
                                        value={minPasswordLength}
                                        onChange={(e) => setMinPasswordLength(Number(e.target.value))}
                                        aria-valuetext={`${minPasswordLength} characters`}
                                        className={RANGE_CLASS}
                                    />
                                    <div className="mt-1 flex justify-between text-[11px] tabular-nums text-fg-faint" aria-hidden="true">
                                        <span>8</span>
                                        <span>24</span>
                                    </div>
                                </div>

                                <fieldset className="space-y-2.5 pt-1">
                                    <legend className="sr-only">Character requirements</legend>
                                    <label htmlFor={uppercaseId} className="flex cursor-pointer items-center gap-3 text-sm text-fg">
                                        <input
                                            id={uppercaseId}
                                            type="checkbox"
                                            checked={requireUppercase}
                                            onChange={() => setRequireUppercase(!requireUppercase)}
                                            className={CHECKBOX_CLASS}
                                        />
                                        Require uppercase letter (A–Z)
                                    </label>
                                    <label htmlFor={numberId} className="flex cursor-pointer items-center gap-3 text-sm text-fg">
                                        <input
                                            id={numberId}
                                            type="checkbox"
                                            checked={requireNumber}
                                            onChange={() => setRequireNumber(!requireNumber)}
                                            className={CHECKBOX_CLASS}
                                        />
                                        Require number (0–9)
                                    </label>
                                    <label htmlFor={specialId} className="flex cursor-pointer items-center gap-3 text-sm text-fg">
                                        <input
                                            id={specialId}
                                            type="checkbox"
                                            checked={requireSpecialChar}
                                            onChange={() => setRequireSpecialChar(!requireSpecialChar)}
                                            className={CHECKBOX_CLASS}
                                        />
                                        Require special character (!@#$%^&amp;*)
                                    </label>
                                </fieldset>
                            </div>
                        </SectionCard>

                        {/* Rotation */}
                        <SectionCard title="Rotation and history">
                            <p className="mb-4 text-xs text-fg-muted">Rotation schedules and reuse restrictions.</p>
                            <div className="space-y-4">
                                <SelectField label="Password expiry" hint="Require staff to change their password periodically." defaultValue="90">
                                    <option value="30">Every 30 days</option>
                                    <option value="60">Every 60 days</option>
                                    <option value="90">Every 90 days</option>
                                    <option value="180">Every 180 days</option>
                                    <option value="0">Never expire (not recommended)</option>
                                </SelectField>

                                <SelectField label="Password history" hint="Prevent reuse of recent passwords." defaultValue="5">
                                    <option value="3">Remember last 3 passwords</option>
                                    <option value="5">Remember last 5 passwords</option>
                                    <option value="10">Remember last 10 passwords</option>
                                    <option value="0">Do not restrict reuse</option>
                                </SelectField>
                            </div>
                        </SectionCard>
                    </div>

                    <ActionBar>
                        <Button variant="primary" icon={KeyRound}>
                            Apply global policy
                        </Button>
                    </ActionBar>
                </div>
            )}
        </div>
    );
}
