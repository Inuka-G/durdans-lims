'use client';

import { INSTRUMENT_STATUS_CONFIG, QC_STATUS_CONFIG } from '@/constants/sample-lifecycle';
import { MOCK_INSTRUMENT_STATUS_FALLBACK } from '@/mock/mlt.mock';
import { getInstruments, syncInstrument, type InstrumentStatusItem } from '@/lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function InstrumentsPage() {
    const [instruments, setInstruments] = useState<InstrumentStatusItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [demoMode, setDemoMode] = useState(false);
    const [syncingId, setSyncingId] = useState<string | null>(null);

    const loadInstruments = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setDemoMode(false);
            const data = await getInstruments();
            setInstruments(data);
        } catch (err) {
            console.error('Failed to load instruments', err);
            setInstruments(MOCK_INSTRUMENT_STATUS_FALLBACK);
            setDemoMode(true);
            setError(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInstruments();
    }, [loadInstruments]);

    const handleSync = useCallback(async (id: string) => {
        if (demoMode) {
            setSyncingId(id);
            setInstruments((current) =>
                current.map((instrument) =>
                    instrument.id === id ? { ...instrument, lastSync: 'Just now (demo)' } : instrument
                )
            );
            setTimeout(() => setSyncingId(null), 600);
            return;
        }
        try {
            setSyncingId(id);
            setError(null);
            const updated = await syncInstrument(id);
            setInstruments((current) => current.map((instrument) => (instrument.id === id ? updated : instrument)));
        } catch (err) {
            console.error('Failed to sync instrument', err);
            setError('Instrument sync failed. Please try again.');
        } finally {
            setSyncingId(null);
        }
    }, [demoMode]);

    const online = useMemo(() => instruments.filter((instrument) => instrument.status === 'online').length, [instruments]);
    const offline = useMemo(() => instruments.filter((instrument) => instrument.status === 'offline').length, [instruments]);

    return (
        <div>
            <div className="mb-6">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Laboratory / Equipment</p>
                <h1 className="text-2xl font-bold text-slate-800 mt-0.5">Instruments</h1>
            </div>

            {demoMode && (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 flex gap-3 items-start">
                    <span className="material-icons text-amber-700 text-xl">precision_manufacturing</span>
                    <div className="text-sm text-amber-950">
                        <p className="font-bold">Instrument middleware offline</p>
                        <p className="text-amber-900/90 mt-1">
                            Showing mock analyser status cards for classroom / demo use. Live deployments typically pull
                            ASTM / HL7 / vendor middleware queues; sync updates the last handshake timestamp only.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex gap-4 mb-6">
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-semibold text-emerald-700">{online} Online</span>
                </div>
                {offline > 0 && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-sm font-semibold text-red-700">{offline} Offline</span>
                    </div>
                )}
            </div>

            {error && !demoMode && (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 mb-6 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {loading && (
                    <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center text-sm text-slate-500">
                        Loading instruments...
                    </div>
                )}

                {!loading &&
                    instruments.map((instrument) => {
                        const statusConfig = INSTRUMENT_STATUS_CONFIG[instrument.status];
                        const qcConfig = QC_STATUS_CONFIG[instrument.qcStatus];

                        return (
                            <div key={instrument.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                                            <span className="material-icons text-xl text-slate-500">biotech</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{instrument.name}</p>
                                            <p className="text-xs text-slate-400">{instrument.type}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`w-2 h-2 rounded-full ${statusConfig.dot} ${
                                                instrument.status === 'online' ? 'animate-pulse' : ''
                                            }`}
                                        />
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${statusConfig.badge}`}>
                                            {statusConfig.label}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                                    <div>
                                        <span className="text-slate-400">Model:</span>
                                        <span className="font-medium text-slate-700 ml-1">{instrument.model}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Serial:</span>
                                        <span className="font-medium text-slate-700 ml-1">{instrument.serial}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Location:</span>
                                        <span className="font-medium text-slate-700 ml-1">{instrument.location}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Last Sync:</span>
                                        <span className="font-medium text-slate-700 ml-1">{instrument.lastSync}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-slate-800">{instrument.testsToday}</p>
                                            <p className="text-[10px] text-slate-400">Tests Today</p>
                                        </div>
                                        <div className="w-px h-8 bg-slate-200" />
                                        <div>
                                            <p className="text-[10px] text-slate-400 mb-0.5">QC Status</p>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${qcConfig.className}`}>
                                                {qcConfig.label}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleSync(instrument.id)}
                                        disabled={syncingId === instrument.id}
                                        className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60"
                                    >
                                        <span className={`material-icons text-sm ${syncingId === instrument.id ? 'animate-spin' : ''}`}>sync</span>
                                        {syncingId === instrument.id ? 'Syncing...' : 'Sync'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                {!loading && instruments.length === 0 && (
                    <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 text-center text-sm text-slate-500">
                        No instruments are available right now.
                    </div>
                )}
            </div>
        </div>
    );
}
