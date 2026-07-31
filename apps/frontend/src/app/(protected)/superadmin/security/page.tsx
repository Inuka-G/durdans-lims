"use client";

import React, { useState } from 'react';
import DemoDataBanner from '@/components/shared/DemoDataBanner';

export default function SecurityConfigurationPage() {
    const [activeTab, setActiveTab] = useState<'idp' | 'mfa' | 'password'>('idp');

    // MOCK STATES FOR TOGGLES
    const [centralizedAuth, setCentralizedAuth] = useState(true);
    const [ssoEnabled, setSsoEnabled] = useState(true);
    const [tokenEncryption, setTokenEncryption] = useState(true);

    const [requireMfaSuperAdmin, setRequireMfaSuperAdmin] = useState(true);
    const [requireMfaBranchAdmin, setRequireMfaBranchAdmin] = useState(false);

    const [requireSpecialChar, setRequireSpecialChar] = useState(true);
    const [requireUppercase, setRequireUppercase] = useState(true);
    const [requireNumber, setRequireNumber] = useState(true);

    return (
        <div className="max-w-[1600px] mx-auto w-full font-sans text-slate-900 bg-slate-50/50 min-h-screen pt-4 pb-12 flex flex-col xl:flex-row xl:flex-wrap gap-6">
            <div className="basis-full"><DemoDataBanner note="Demo console — these security toggles are placeholders and do not change live auth policy." /></div>

            {/* Left Sidebar for Tabs */}
            <div className="w-full xl:w-[280px] flex-shrink-0 flex flex-col gap-2">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-24">
                    <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 px-3 mt-2">Security Hub</h2>

                    <nav className="flex flex-col gap-1.5">
                        <button
                            onClick={() => setActiveTab('idp')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${activeTab === 'idp' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50 font-semibold'}`}
                        >
                            <span className="material-icons text-[20px]">admin_panel_settings</span>
                            <span className="text-sm">Identity Provider</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('mfa')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${activeTab === 'mfa' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50 font-semibold'}`}
                        >
                            <span className="material-icons text-[20px]">phonelink_lock</span>
                            <span className="text-sm">MFA & OTP Rules</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('password')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${activeTab === 'password' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50 font-semibold'}`}
                        >
                            <span className="material-icons text-[20px]">password</span>
                            <span className="text-sm">Password Policies</span>
                        </button>
                    </nav>

                    <div className="mt-8 pt-6 border-t border-slate-100 px-3">
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                            <div className="flex items-center gap-2 text-amber-600 mb-2">
                                <span className="material-icons text-sm">warning</span>
                                <span className="text-xs font-bold uppercase tracking-wider">Caution</span>
                            </div>
                            <p className="text-[11px] font-medium text-amber-700/80 leading-relaxed">
                                Changes to Identity Provider settings may require active users to re-authenticate.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col gap-6">

                {/* IDP Tab */}
                {activeTab === 'idp' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Keycloak Identity Provider</h2>
                                    <p className="text-sm font-medium text-slate-500">Global configure for centralized authentication and token management.</p>
                                </div>
                                <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-xs font-bold uppercase tracking-widest">Connected</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                                {/* Core Toggles */}
                                <div className="space-y-6">
                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                                        <div className="pr-4">
                                            <h4 className="text-sm font-bold text-slate-800 mb-1">Centralized Authentication</h4>
                                            <p className="text-[11px] text-slate-500 font-medium">Require all users to verify identity against the central Keycloak DB.</p>
                                        </div>
                                        <button
                                            onClick={() => setCentralizedAuth(!centralizedAuth)}
                                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${centralizedAuth ? 'bg-blue-600' : 'bg-slate-200'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${centralizedAuth ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                                        <div className="pr-4">
                                            <h4 className="text-sm font-bold text-slate-800 mb-1">Single Sign-On (SSO)</h4>
                                            <p className="text-[11px] text-slate-500 font-medium">Log in once to access Sample Collection, Testing, and Billing modules.</p>
                                        </div>
                                        <button
                                            onClick={() => setSsoEnabled(!ssoEnabled)}
                                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${ssoEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${ssoEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                                        <div className="pr-4">
                                            <h4 className="text-sm font-bold text-slate-800 mb-1">Enforce JWT Encryption</h4>
                                            <p className="text-[11px] text-slate-500 font-medium">Ensure token signatures are encrypted across all microservices.</p>
                                        </div>
                                        <button
                                            onClick={() => setTokenEncryption(!tokenEncryption)}
                                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${tokenEncryption ? 'bg-blue-600' : 'bg-slate-200'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${tokenEncryption ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Connection Details */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Keycloak Server URL</label>
                                        <input type="text" defaultValue="https://auth.laboratory-erp.com/auth" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Realm Name</label>
                                        <input type="text" defaultValue="LIMS-Global-Realm" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Admin Client ID</label>
                                        <input type="text" defaultValue="lims-superadmin-cli" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Admin Client Secret</label>
                                        <input type="password" defaultValue="************************" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100 my-8" />

                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-extrabold text-slate-800 mb-1">Token Lifespan Management</h4>
                                    <p className="text-xs text-slate-500 font-medium">Manage expiration durations for security tokens.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Access Token</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" defaultValue={15} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800" />
                                        <span className="text-xs font-bold text-slate-400">MINS</span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Refresh Token</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" defaultValue={24} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800" />
                                        <span className="text-xs font-bold text-slate-400">HOURS</span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">SSO Session Idle</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" defaultValue={30} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800" />
                                        <span className="text-xs font-bold text-slate-400">MINS</span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">SSO Session Max</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" defaultValue={10} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800" />
                                        <span className="text-xs font-bold text-slate-400">HOURS</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-10 flex justify-end gap-3">
                                <button className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                                    Discard Changes
                                </button>
                                <button className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2">
                                    <span className="material-icons text-[18px]">save</span>
                                    Save IDP Config
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MFA Tab */}
                {activeTab === 'mfa' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                            <div className="mb-8">
                                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">MFA & OTP strictness</h2>
                                <p className="text-sm font-medium text-slate-500">Configure multi-factor authentication requirements globally and for specific roles.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                {/* Role Based MFA */}
                                <div>
                                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Role Requirements</h3>

                                    <div className="space-y-3">
                                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                                    <span className="material-icons text-[16px]">admin_panel_settings</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">Super Administrator</p>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mandatory Authenticator App</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setRequireMfaSuperAdmin(!requireMfaSuperAdmin)}
                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${requireMfaSuperAdmin ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                            >
                                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${requireMfaSuperAdmin ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>

                                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                                    <span className="material-icons text-[16px]">manage_accounts</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">Branch Administrator</p>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mandatory Authenticator App</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setRequireMfaBranchAdmin(!requireMfaBranchAdmin)}
                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${requireMfaBranchAdmin ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                            >
                                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${requireMfaBranchAdmin ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* OTP Configuration */}
                                <div>
                                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">OTP Generation Rules</h3>

                                    <div className="space-y-5">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs font-bold text-slate-600">OTP Length</label>
                                                <span className="text-xs font-bold text-indigo-600">6 Digits</span>
                                            </div>
                                            <input type="range" min="4" max="8" step="1" defaultValue="6" className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                                            <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
                                                <span>4</span>
                                                <span>8</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-2">Expiration Time</label>
                                                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-colors">
                                                    <input type="number" defaultValue="5" className="w-full px-3 py-2.5 text-sm font-bold text-slate-800 outline-none" />
                                                    <div className="bg-slate-50 px-3 py-2.5 border-l border-slate-200 text-xs font-bold text-slate-500">MINS</div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-2">Max Retry Attempts</label>
                                                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-colors">
                                                    <input type="number" defaultValue="3" className="w-full px-3 py-2.5 text-sm font-bold text-slate-800 outline-none" />
                                                    <div className="bg-slate-50 px-3 py-2.5 border-l border-slate-200 text-xs font-bold text-slate-500">TIMES</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
                                <button className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-500/20 transition-all flex items-center gap-2">
                                    <span className="material-icons text-[18px]">security</span>
                                    Enforce MFA Policies
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Password Tab */}
                {activeTab === 'password' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
                            <div className="mb-8">
                                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Password Standards</h2>
                                <p className="text-sm font-medium text-slate-500">Global requirements for password complexity and rotation schedules.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {/* Complexity */}
                                <div>
                                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-5 border-b border-slate-100 pb-2">Complexity Rules</h3>

                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs font-bold text-slate-600">Minimum Length</label>
                                                <span className="text-xs font-bold text-emerald-600">12 Chars</span>
                                            </div>
                                            <input type="range" min="8" max="24" step="1" defaultValue="12" className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                                            <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
                                                <span>8</span>
                                                <span>24</span>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-2">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className="relative flex items-center">
                                                    <input type="checkbox" checked={requireUppercase} onChange={() => setRequireUppercase(!requireUppercase)} className="w-5 h-5 opacity-0 absolute z-10 cursor-pointer" />
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${requireUppercase ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 group-hover:border-emerald-400'}`}>
                                                        {requireUppercase && <span className="material-icons text-[14px]">check</span>}
                                                    </div>
                                                </div>
                                                <span className="text-sm font-semibold text-slate-700">Require uppercase letter (A-Z)</span>
                                            </label>

                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className="relative flex items-center">
                                                    <input type="checkbox" checked={requireNumber} onChange={() => setRequireNumber(!requireNumber)} className="w-5 h-5 opacity-0 absolute z-10 cursor-pointer" />
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${requireNumber ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 group-hover:border-emerald-400'}`}>
                                                        {requireNumber && <span className="material-icons text-[14px]">check</span>}
                                                    </div>
                                                </div>
                                                <span className="text-sm font-semibold text-slate-700">Require number (0-9)</span>
                                            </label>

                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className="relative flex items-center">
                                                    <input type="checkbox" checked={requireSpecialChar} onChange={() => setRequireSpecialChar(!requireSpecialChar)} className="w-5 h-5 opacity-0 absolute z-10 cursor-pointer" />
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${requireSpecialChar ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 group-hover:border-emerald-400'}`}>
                                                        {requireSpecialChar && <span className="material-icons text-[14px]">check</span>}
                                                    </div>
                                                </div>
                                                <span className="text-sm font-semibold text-slate-700">Require special character (!@#$%^&*)</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Rotation */}
                                <div>
                                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-5 border-b border-slate-100 pb-2">Rotation & History</h3>

                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-2">Password Expiry (Days)</label>
                                            <p className="text-[11px] text-slate-500 font-medium mb-3">Require staff to change their password periodically.</p>
                                            <select className="w-full bg-slate-50 border border-slate-200 py-3 px-4 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none bg-no-repeat bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[position:calc(100%_-_16px)_center] bg-[length:16px_16px]">
                                                <option value="30">Every 30 days</option>
                                                <option value="60">Every 60 days</option>
                                                <option value="90" selected>Every 90 days</option>
                                                <option value="180">Every 180 days</option>
                                                <option value="0">Never expire (Not Recommended)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-2">Password History</label>
                                            <p className="text-[11px] text-slate-500 font-medium mb-3">Prevent reuse of recent passwords.</p>
                                            <select className="w-full bg-slate-50 border border-slate-200 py-3 px-4 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none bg-no-repeat bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[position:calc(100%_-_16px)_center] bg-[length:16px_16px]">
                                                <option value="3">Remember last 3 passwords</option>
                                                <option value="5" selected>Remember last 5 passwords</option>
                                                <option value="10">Remember last 10 passwords</option>
                                                <option value="0">Do not restrict reuse</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
                                <button className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 transition-all flex items-center gap-2">
                                    <span className="material-icons text-[18px]">verified_user</span>
                                    Apply Global Policy
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
