"use client";

import { useState } from "react";
import DemoDataBanner from "@/components/shared/DemoDataBanner";

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

    return (
        <div className="max-w-[1400px] mx-auto w-full font-sans text-slate-900 min-h-[calc(100vh-136px)] pt-2 pb-10 flex flex-col">
            <DemoDataBanner note="Demo screen — these MFA settings are placeholders and are not saved to the identity provider." />

            {/* Breadcrumb & Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                    <span className="hover:text-slate-800 cursor-pointer transition-colors">Admin Area</span>
                    <span className="text-[10px] opacity-50">/</span>
                    <span className="text-slate-800 font-bold">Two-Factor Authentication (2FA)</span>
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Global 2FA Policy</h1>
                <p className="text-sm font-medium text-slate-500 mt-1 pb-4">Define active enforcement zones and permitted alternative verification scopes.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">

                {/* Main Configuration Area */}
                <div className="bg-white border text-sm border-slate-200 shadow-sm rounded-2xl flex flex-col overflow-hidden">

                    {/* Header bar of the card */}
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <span className="material-icons text-slate-400 text-[20px]">verified_user</span>
                            <h2 className="text-[15px] font-extrabold text-slate-800">2FA Enforcement Rules</h2>
                        </div>
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
                            Active Ruleset
                        </span>
                    </div>

                    <div className="p-6">
                        <div className="flex flex-col gap-8">

                            {/* Enforcement */}
                            <div>
                                <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest mb-4">Enforcement Level</h3>

                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-4 flex items-center justify-between shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-[14px] font-bold text-slate-800">Global Enforce 2FA</span>
                                        <span className="text-[12px] font-medium text-slate-500">Require 2FA for ALL users across all branches.</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setTfaConfig(p => ({ ...p, globalEnforce: !p.globalEnforce }))}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${tfaConfig.globalEnforce ? 'bg-blue-600' : 'bg-slate-300'}`}
                                    >
                                        <span className={`pointer-events-none absolute left-0 inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out border border-slate-200/50 ${tfaConfig.globalEnforce ? 'translate-x-[22px] border-transparent' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                <div className={`transition-opacity ${tfaConfig.globalEnforce ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                    <label className="flex items-center justify-between p-4 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="text-[14px] font-bold text-slate-800">Enforce for Administrators Only</span>
                                            <span className="text-[12px] font-medium text-slate-500">Only require 2FA for Branch Admins, Dept Heads, and SuperAdmins.</span>
                                        </div>
                                        <input type="checkbox" className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                                            checked={tfaConfig.enforceAdminOnly}
                                            onChange={(e) => setTfaConfig({ ...tfaConfig, enforceAdminOnly: e.target.checked })}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Allowed Methods */}
                            <div>
                                <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest mb-4">Allowed Methods</h3>
                                <div className="flex flex-col gap-3">
                                    <label className="flex items-center gap-3 cursor-pointer group bg-white border border-slate-100 p-3 rounded-xl hover:border-slate-200 transition-colors">
                                        <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            checked={tfaConfig.allowAuthenticator}
                                            onChange={(e) => setTfaConfig({ ...tfaConfig, allowAuthenticator: e.target.checked })}
                                        />
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                                <span className="material-icons text-[16px]">qr_code_scanner</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-bold text-slate-800">Authenticator App (TOTP)</span>
                                                <span className="text-[11px] font-semibold text-slate-400">Google Authenticator, Authy, etc.</span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest px-2 py-0.5 bg-emerald-50 rounded">Recommended</span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group bg-white border border-slate-100 p-3 rounded-xl hover:border-slate-200 transition-colors">
                                        <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            checked={tfaConfig.allowSMS}
                                            onChange={(e) => setTfaConfig({ ...tfaConfig, allowSMS: e.target.checked })}
                                        />
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                                <span className="material-icons text-[16px]">sms</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-bold text-slate-700">SMS Verification</span>
                                                <span className="text-[11px] font-semibold text-slate-400">Sends a 6-digit code via text message.</span>
                                            </div>
                                        </div>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group bg-white border border-slate-100 p-3 rounded-xl hover:border-slate-200 transition-colors">
                                        <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            checked={tfaConfig.allowEmail}
                                            onChange={(e) => setTfaConfig({ ...tfaConfig, allowEmail: e.target.checked })}
                                        />
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                                <span className="material-icons text-[16px]">mark_email_read</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-bold text-slate-700">Email Verification</span>
                                                <span className="text-[11px] font-semibold text-slate-400">Sends a verification link to the registered email.</span>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Settings */}
                            <div>
                                <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest mb-4">Timeout Settings</h3>
                                <div className="flex flex-col gap-2 max-w-[240px]">
                                    <label className="text-[13px] font-bold text-slate-700">Remember Device for (Days)</label>
                                    <input
                                        type="number"
                                        min="0" max="60"
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold py-2.5 px-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        value={tfaConfig.sessionTimeout}
                                        onChange={(e) => setTfaConfig({ ...tfaConfig, sessionTimeout: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-auto border-t border-slate-100 bg-slate-50/50 p-6 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-sm ${isSaving ? 'opacity-70 scale-95 pointer-events-none' : 'active:scale-95 shadow-blue-500/30'}`}
                        >
                            {isSaving ? (
                                <>
                                    <span className="material-icons text-[18px] animate-spin">sync</span>
                                    Applying Policies...
                                </>
                            ) : (
                                <>
                                    <span className="material-icons text-[18px]">verified</span>
                                    Save 2FA Policy
                                </>
                            )}
                        </button>
                    </div>

                </div>

                {/* Right Sidebar - Contextual Info */}
                <div className="flex flex-col gap-6">

                    {/* Usage Stats (Specific to 2FA) */}
                    <div className="bg-white border text-sm border-slate-200 shadow-sm rounded-2xl p-6">
                        <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest mb-5">2FA Adoption Metrics</h3>

                        <div className="space-y-5">
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-[13px] font-bold text-slate-700">Admin Adoption</span>
                                    <span className="text-[14px] font-extrabold text-slate-900">100%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 w-full"></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-[13px] font-bold text-slate-700">General Staff Adoption</span>
                                    <span className="text-[14px] font-extrabold text-slate-900">42%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-400 w-[42%]"></div>
                                </div>
                                <p className="text-[11px] font-semibold text-slate-500 mt-2 leading-snug">Consider enabling &quot;Global Enforce&quot; to drive complete adoption across all branches.</p>
                            </div>
                        </div>
                    </div>

                    {/* Information Box */}
                    <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl">
                        <div className="flex items-start gap-3">
                            <span className="material-icons text-blue-500 text-[20px]">info</span>
                            <div className="flex flex-col gap-2">
                                <span className="text-[13px] font-bold text-blue-900">Policy Synchronization</span>
                                <p className="text-[12px] font-medium text-blue-800/80 leading-relaxed">
                                    2FA enforcements take immediate effect and may terminate active workflow sessions for non-compliant users.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>

            </div>

        </div>
    );
}
