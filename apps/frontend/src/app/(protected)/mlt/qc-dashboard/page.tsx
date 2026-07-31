'use client';

import { QC_STATUS_CONFIG } from '@/constants/sample-lifecycle';
import { MOCK_QC_DASHBOARD_DATA } from '@/mock/mlt.mock';
import { getQcDashboard, type QcDashboardData } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

const STAT_CARD_STYLES = {
    blue: {
        iconClasses: 'bg-blue-100 text-blue-600',
    },
    emerald: {
        iconClasses: 'bg-emerald-100 text-emerald-600',
    },
    amber: {
        iconClasses: 'bg-amber-100 text-amber-600',
    },
    red: {
        iconClasses: 'bg-red-100 text-red-600',
    },
};

export default function QCDashboardPage() {
    const [dashboard, setDashboard] = useState<QcDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [demoMode, setDemoMode] = useState(false);

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setDemoMode(false);
            const data = await getQcDashboard();
            setDashboard(data);
        } catch (err) {
            console.error('Failed to load QC dashboard', err);
            setDashboard(MOCK_QC_DASHBOARD_DATA);
            setDemoMode(true);
            setError(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const runs = dashboard?.runs ?? [];
    const passCount = dashboard?.passed ?? 0;
    const failCount = dashboard?.failures ?? 0;
    const warnCount = dashboard?.warnings ?? 0;

    return (
        <div>
            <div className="mb-6">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Laboratory / Quality Control</p>
                <h1 className="text-2xl font-bold text-slate-800 mt-0.5">QC Dashboard</h1>
            </div>

            {demoMode && (
                <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 flex gap-3 items-start">
                    <span className="material-icons text-violet-600 text-xl">science</span>
                    <div className="text-sm text-violet-900">
                        <p className="font-bold">Demo QC data</p>
                        <p className="text-violet-800/90 mt-1">
                            No live middleware or analyser interface detected — showing representative QC runs so training
                            and UI reviews can continue without hardware. When the API is available, live Westgard / L-J
                            style summaries replace this block automatically.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                {[
                    { label: 'Total QC Runs', value: dashboard?.totalRuns ?? 0, icon: 'assessment', tone: 'blue' as const },
                    { label: 'Passed', value: passCount, icon: 'check_circle', tone: 'emerald' as const },
                    { label: 'Warnings', value: warnCount, icon: 'warning', tone: 'amber' as const },
                    { label: 'Failures', value: failCount, icon: 'cancel', tone: 'red' as const },
                ].map((stat) => (
                    <div key={stat.label} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${STAT_CARD_STYLES[stat.tone].iconClasses}`}>
                            <span className="material-icons">{stat.icon}</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                        <p className="text-xs text-slate-500">{stat.label}</p>
                    </div>
                ))}
            </div>

            {failCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3">
                    <span className="material-icons text-red-600">error</span>
                    <p className="text-sm text-red-700 font-medium">
                        {failCount} QC run(s) failed. Instruments with failed QC should not be used until corrective action is taken.
                    </p>
                </div>
            )}

            {error && !demoMode && (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 mb-6 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-700">Today&apos;s QC Runs</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <th className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">Instrument</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Test Group</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Level</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Result</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Expected</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">SD</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Status</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">By</th>
                                <th className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-500">
                                        Loading QC runs...
                                    </td>
                                </tr>
                            )}
                            {!loading && runs.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-500">
                                        No QC runs are available right now.
                                    </td>
                                </tr>
                            )}
                            {!loading &&
                                runs.map((run) => {
                                    const statusConfig = QC_STATUS_CONFIG[run.status];
                                    return (
                                        <tr
                                            key={run.id}
                                            className={`border-b border-slate-50 last:border-0 transition-colors ${
                                                run.status === 'FAIL' ? 'bg-red-50/50' : 'hover:bg-slate-50/50'
                                            }`}
                                        >
                                            <td className="px-5 py-3 font-semibold text-slate-700">{run.instrument}</td>
                                            <td className="px-4 py-3 text-slate-700">{run.testGroup}</td>
                                            <td className="px-4 py-3 text-slate-500">{run.level}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-800">{run.result}</td>
                                            <td className="px-4 py-3 text-slate-500">{run.expected}</td>
                                            <td className="px-4 py-3 text-slate-500">{run.sd}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${statusConfig.className}`}>
                                                    {statusConfig.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">{run.performedBy}</td>
                                            <td className="px-4 py-3 text-slate-500">{run.timestamp}</td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
