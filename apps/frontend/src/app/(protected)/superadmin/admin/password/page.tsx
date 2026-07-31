"use client";

import { useState } from "react";
import DemoDataBanner from "@/components/shared/DemoDataBanner";

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

    return (
        <div className="max-w-[1400px] mx-auto w-full font-sans text-slate-900 min-h-[calc(100vh-136px)] pt-2 pb-10 flex flex-col">
            <DemoDataBanner note="Demo screen — this password policy is a placeholder and is not applied to the identity provider." />

            {/* Breadcrumb & Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                    <span className="hover:text-slate-800 cursor-pointer transition-colors">Admin Area</span>
                    <span className="text-[10px] opacity-50">/</span>
                    <span className="text-slate-800 font-bold">Password Policy</span>
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Global Password Policy</h1>
                <p className="text-sm font-medium text-slate-500 mt-1 pb-4">Define character complexity rules and lifecycle constraints enforced across all hospital branches.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">

                {/* Main Configuration Area */}
                <div className="bg-white border text-sm border-slate-200 shadow-sm rounded-2xl flex flex-col overflow-hidden">

                    {/* Header bar of the card */}
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <span className="material-icons text-slate-400 text-[20px]">password</span>
                            <h2 className="text-[15px] font-extrabold text-slate-800">Password Complexity Rules</h2>
                        </div>
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
                            Active Ruleset
                        </span>
                    </div>

                    <div className="p-6">
                        <div className="flex flex-col gap-8">

                            {/* Base Requirements */}
                            <div>
                                <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest mb-4">Base Requirements</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[13px] font-bold text-slate-700">Minimum Password Length</label>
                                        <input
                                            type="number"
                                            min="8" max="64"
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold py-2.5 px-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all max-w-[120px]"
                                            value={pwdConfig.minLength}
                                            onChange={(e) => setPwdConfig({ ...pwdConfig, minLength: Number(e.target.value) })}
                                        />
                                        <p className="text-[11px] font-semibold text-slate-400">Industry standard is 12 or more.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Character Requirements */}
                            <div>
                                <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest mb-4">Character Composition</h3>
                                <div className="flex flex-col gap-4">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            checked={pwdConfig.requireUppercase}
                                            onChange={(e) => setPwdConfig({ ...pwdConfig, requireUppercase: e.target.checked })}
                                        />
                                        <span className="text-[14px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Require Uppercase Letters (A-Z)</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            checked={pwdConfig.requireLowercase}
                                            onChange={(e) => setPwdConfig({ ...pwdConfig, requireLowercase: e.target.checked })}
                                        />
                                        <span className="text-[14px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Require Lowercase Letters (a-z)</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            checked={pwdConfig.requireNumbers}
                                            onChange={(e) => setPwdConfig({ ...pwdConfig, requireNumbers: e.target.checked })}
                                        />
                                        <span className="text-[14px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Require Numbers (0-9)</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                            checked={pwdConfig.requireSpecial}
                                            onChange={(e) => setPwdConfig({ ...pwdConfig, requireSpecial: e.target.checked })}
                                        />
                                        <span className="text-[14px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Require Special Characters (!@#$%)</span>
                                    </label>
                                </div>
                            </div>

                            {/* Lifecycle */}
                            <div>
                                <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest mb-4">Lifecycle & History</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[13px] font-bold text-slate-700">Password Expiration (Days)</label>
                                        <input
                                            type="number"
                                            min="0" max="365"
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold py-2.5 px-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            value={pwdConfig.expiryDays}
                                            onChange={(e) => setPwdConfig({ ...pwdConfig, expiryDays: Number(e.target.value) })}
                                        />
                                        <p className="text-[11px] font-semibold text-slate-400">Set 0 to disable automatic expiration.</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[13px] font-bold text-slate-700">Prevent Reuse Limit</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0" max="24"
                                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold py-2.5 px-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-right pr-20"
                                                value={pwdConfig.historyCount}
                                                onChange={(e) => setPwdConfig({ ...pwdConfig, historyCount: Number(e.target.value) })}
                                            />
                                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-slate-400 pointer-events-none">passwords</span>
                                        </div>
                                        <p className="text-[11px] font-semibold text-slate-400">Number of previous passwords remembered.</p>
                                    </div>
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
                                    Save Configuration
                                </>
                            )}
                        </button>
                    </div>

                </div>

                {/* Right Sidebar - Contextual Info */}
                <div className="flex flex-col gap-6">

                    {/* Security Score */}
                    <div className="bg-white border text-sm border-slate-200 shadow-sm rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-0"></div>
                        <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest mb-6 relative z-10">Password Strength</h3>

                        <div className="flex items-center justify-center relative z-10 mb-2">
                            <svg className="w-32 h-32 transform -rotate-90">
                                <circle cx="64" cy="64" r="56" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                                <circle cx="64" cy="64" r="56" fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray="351.85" strokeDashoffset="80.22" strokeLinecap="round" />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center">
                                <span className="text-3xl font-black text-slate-800">77<span className="text-lg text-slate-400">%</span></span>
                            </div>
                        </div>
                        <p className="text-center text-[12px] font-bold text-emerald-600 mt-4 relative z-10 bg-emerald-50 py-1.5 rounded-lg">Adequate Protection</p>
                    </div>

                    {/* Information Box */}
                    <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl">
                        <div className="flex items-start gap-3">
                            <span className="material-icons text-blue-500 text-[20px]">info</span>
                            <div className="flex flex-col gap-2">
                                <span className="text-[13px] font-bold text-blue-900">Policy Synchronization</span>
                                <p className="text-[12px] font-medium text-blue-800/80 leading-relaxed">
                                    Changes to password policies do not invalidate existing session tokens, but will be enforced the next time a user changes their password.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>

            </div>

        </div>
    );
}
