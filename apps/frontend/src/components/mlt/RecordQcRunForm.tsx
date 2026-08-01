'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    getInstrumentRegistry,
    getQcAnalytes,
    recordQcRun,
    type InstrumentOption,
    type QcAnalyteOption,
    type QcRunOutcome
} from '@/lib/api';

/**
 * Records an internal-QC run.
 *
 * <p>This exists because QC now gates release: a result whose governing control
 * failed, went stale, or was never recorded is held at verification. Before the
 * gate there was nowhere in the application to record a control at all — the
 * endpoint existed and no screen called it — so the dashboard showed seeded demo
 * runs and nothing was ever actually controlled.
 *
 * <p>Instrument and analyte are pickers rather than text inputs on purpose. Both
 * are join keys for the gate; a typed instrument name or a misremembered LOINC
 * produces a control that looks recorded and governs nothing.
 */
export default function RecordQcRunForm({ onRecorded }: { onRecorded: () => void }) {
    const [instruments, setInstruments] = useState<InstrumentOption[]>([]);
    const [analytes, setAnalytes] = useState<QcAnalyteOption[]>([]);
    const [loadingOptions, setLoadingOptions] = useState(true);

    const [instrument, setInstrument] = useState('');
    const [loincCode, setLoincCode] = useState('');
    const [controlLevel, setControlLevel] = useState('L1');
    const [controlLot, setControlLot] = useState('');
    const [measuredValue, setMeasuredValue] = useState('');
    const [mean, setMean] = useState('');
    const [sd, setSd] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [outcome, setOutcome] = useState<QcRunOutcome | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [inst, an] = await Promise.all([getInstrumentRegistry(), getQcAnalytes()]);
                if (cancelled) return;
                // Bench methods have no analyser, so no analyser control can be run.
                setInstruments(inst.filter((i) => i.qcRequired));
                setAnalytes(an);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Could not load instruments and analytes.');
                }
            } finally {
                if (!cancelled) setLoadingOptions(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const analyteName = useMemo(
        () => analytes.find((a) => a.loincCode === loincCode)?.name ?? '',
        [analytes, loincCode]
    );

    const numeric = (v: string) => (v.trim() === '' ? null : Number(v));
    const canSubmit =
        instrument !== '' &&
        loincCode !== '' &&
        controlLevel.trim() !== '' &&
        numeric(measuredValue) !== null &&
        numeric(mean) !== null &&
        Number(sd) > 0;

    const submit = async () => {
        if (!canSubmit) return;
        try {
            setSubmitting(true);
            setError(null);
            setOutcome(null);
            const result = await recordQcRun({
                instrument,
                analyte: analyteName || loincCode,
                loincCode,
                controlLevel: controlLevel.trim(),
                controlLot: controlLot.trim() || undefined,
                measuredValue: Number(measuredValue),
                mean: Number(mean),
                sd: Number(sd)
            });
            setOutcome(result);
            setMeasuredValue('');
            onRecorded();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not record this QC run.');
        } finally {
            setSubmitting(false);
        }
    };

    const outcomeStyle =
        outcome?.status === 'FAIL'
            ? 'border-red-200 bg-red-50 text-red-800'
            : outcome?.status === 'WARN'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800';

    return (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold text-slate-800">Record a QC run</h2>
            <p className="mt-1 text-sm text-slate-600">
                Results are held at verification until the control governing their analyser and
                analyte has passed.
            </p>

            {loadingOptions ? (
                <p className="mt-4 text-sm text-slate-500">Loading instruments and analytes…</p>
            ) : (
                <>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <label className="block">
                            <span className="text-sm font-medium text-slate-700">Instrument</span>
                            <select
                                value={instrument}
                                onChange={(e) => setInstrument(e.target.value)}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            >
                                <option value="">Select…</option>
                                {instruments.map((i) => (
                                    <option key={i.code} value={i.code}>
                                        {i.name} ({i.code})
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-slate-700">Analyte</span>
                            <select
                                value={loincCode}
                                onChange={(e) => setLoincCode(e.target.value)}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            >
                                <option value="">Select…</option>
                                {analytes.map((a) => (
                                    <option key={a.loincCode} value={a.loincCode}>
                                        {a.name} ({a.loincCode})
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-slate-700">Control level</span>
                            <input
                                value={controlLevel}
                                onChange={(e) => setControlLevel(e.target.value)}
                                placeholder="L1"
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-slate-700">Measured value</span>
                            <input
                                type="number"
                                step="any"
                                value={measuredValue}
                                onChange={(e) => setMeasuredValue(e.target.value)}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-slate-700">Target mean</span>
                            <input
                                type="number"
                                step="any"
                                value={mean}
                                onChange={(e) => setMean(e.target.value)}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-slate-700">SD</span>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                value={sd}
                                onChange={(e) => setSd(e.target.value)}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                            <span className="mt-1 block text-xs text-slate-500">Must be greater than zero.</span>
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-slate-700">Control lot (optional)</span>
                            <input
                                value={controlLot}
                                onChange={(e) => setControlLot(e.target.value)}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                        </label>
                    </div>

                    {error && (
                        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {outcome && (
                        <div className={`mt-4 rounded-md border p-3 text-sm ${outcomeStyle}`}>
                            <span className="font-semibold">Westgard: {outcome.status}</span>
                            {outcome.violations.length > 0 && <> — {outcome.violations.join(', ')}</>}
                            {outcome.status === 'FAIL' && (
                                <p className="mt-1">
                                    Results on this analyser for this analyte are now held until a passing
                                    control is recorded, or a supervisor releases over the failure.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={() => void submit()}
                            disabled={!canSubmit || submitting}
                            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                        >
                            {submitting ? 'Recording…' : 'Record QC run'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
