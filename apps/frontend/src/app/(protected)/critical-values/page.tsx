'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    acknowledgeCriticalValue,
    getOpenCriticalValues,
    type CriticalNotification
} from '@/lib/api';

/**
 * Critical-value (panic) callback worklist.
 *
 * The backend has raised these callbacks for some time — on result entry, on
 * instrument ingestion, and now on an amendment that corrects a value into the
 * critical range. Nothing in the application called the acknowledge API, so every
 * callback escalated on its timer to the configured fallback contact and then
 * auto-closed with nobody having confirmed a clinician was told. This screen is
 * the missing half.
 *
 * Acknowledging requires a read-back: the clinician repeats the value back, and
 * that repetition is what evidences it was heard correctly. The backend rejects a
 * blank read-back.
 */

const REFRESH_MS = 30_000;

const FLAG_CONFIG: Record<string, { label: string; className: string }> = {
    CRITICAL_LOW: { label: 'CRITICAL LOW', className: 'bg-red-100 text-red-700 ring-1 ring-red-300' },
    CRITICAL_HIGH: { label: 'CRITICAL HIGH', className: 'bg-red-100 text-red-700 ring-1 ring-red-300' }
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    PENDING: { label: 'Awaiting call', className: 'bg-amber-100 text-amber-800' },
    NOTIFIED: { label: 'Notified', className: 'bg-sky-100 text-sky-700' },
    ESCALATED: { label: 'Escalated', className: 'bg-red-100 text-red-700' }
};

const formatDateTime = (value?: string | null) => {
    if (!value) {
        return '—';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return parsed.toLocaleString('en-LK', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/** Minutes until the next escalation fires, negative once it is overdue. */
const minutesUntil = (value?: string | null) => {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return Math.round((parsed.getTime() - Date.now()) / 60_000);
};

const escalationHint = (item: CriticalNotification) => {
    const mins = minutesUntil(item.nextEscalationDueAt);
    if (mins === null) {
        return { text: '—', className: 'text-slate-400' };
    }
    if (mins < 0) {
        return { text: `overdue by ${Math.abs(mins)} min`, className: 'text-red-600 font-semibold' };
    }
    if (mins <= 5) {
        return { text: `escalates in ${mins} min`, className: 'text-red-600 font-semibold' };
    }
    return { text: `escalates in ${mins} min`, className: 'text-slate-600' };
};

export default function CriticalValuesPage() {
    const [items, setItems] = useState<CriticalNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selected, setSelected] = useState<CriticalNotification | null>(null);
    const [readBackText, setReadBackText] = useState('');
    const [communicatedTo, setCommunicatedTo] = useState('');
    const [readBackVerified, setReadBackVerified] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const load = useCallback(async (showSpinner: boolean) => {
        try {
            if (showSpinner) {
                setLoading(true);
            }
            setError(null);
            setItems(await getOpenCriticalValues());
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to load critical-value callbacks.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(true);
    }, [load]);

    // These are time-critical and escalate on a timer, so the list refreshes
    // itself rather than waiting for someone to reload the page.
    useEffect(() => {
        const timer = setInterval(() => void load(false), REFRESH_MS);
        return () => clearInterval(timer);
    }, [load]);

    const openDialog = (item: CriticalNotification) => {
        setSelected(item);
        setReadBackText('');
        setCommunicatedTo('');
        setReadBackVerified(false);
        setSubmitError(null);
    };

    const closeDialog = () => {
        setSelected(null);
        setSubmitError(null);
    };

    /**
     * A read-back that does not contain the number is not a read-back. The backend
     * only requires non-blank text, so this is a prompt rather than a block —
     * a clinician may legitimately phrase it differently.
     */
    const readBackMissingValue = useMemo(() => {
        if (!selected?.resultValue || !readBackText.trim()) {
            return false;
        }
        return !readBackText.includes(selected.resultValue.trim());
    }, [selected, readBackText]);

    const submit = async () => {
        if (!selected || !readBackText.trim()) {
            return;
        }
        try {
            setSubmitting(true);
            setSubmitError(null);
            await acknowledgeCriticalValue(selected.id, {
                readBackText: readBackText.trim(),
                communicatedTo: communicatedTo.trim() || undefined,
                readBackVerified
            });
            closeDialog();
            await load(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to acknowledge this callback.';
            setSubmitError(message);
        } finally {
            setSubmitting(false);
        }
    };

    const overdueCount = items.filter((item) => (minutesUntil(item.nextEscalationDueAt) ?? 1) < 0).length;

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-semibold text-slate-900">Critical Values</h1>
                <p className="mt-1 text-sm text-slate-600">
                    Panic values awaiting a clinician callback. Each one must be telephoned and
                    acknowledged with a read-back — unacknowledged callbacks escalate automatically.
                </p>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700 ring-1 ring-red-200">
                    {items.length} open
                </span>
                {overdueCount > 0 && (
                    <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white">
                        {overdueCount} overdue
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => void load(true)}
                    className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                    Refresh
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="py-16 text-center text-slate-500">Loading critical-value callbacks…</div>
            ) : items.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white py-16 text-center">
                    <p className="text-slate-700">No open critical-value callbacks.</p>
                    <p className="mt-1 text-sm text-slate-500">
                        Panic values raised by result entry, instrument ingestion or an amendment appear here.
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Patient</th>
                                <th className="px-4 py-3">Analyte</th>
                                <th className="px-4 py-3">Value</th>
                                <th className="px-4 py-3">Flag</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Raised</th>
                                <th className="px-4 py-3">Escalation</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item) => {
                                const flag = FLAG_CONFIG[(item.flag ?? '').toUpperCase()] ?? {
                                    label: item.flag ?? '—',
                                    className: 'bg-slate-100 text-slate-600'
                                };
                                const status = STATUS_CONFIG[(item.status ?? '').toUpperCase()] ?? {
                                    label: item.status ?? '—',
                                    className: 'bg-slate-100 text-slate-600'
                                };
                                const hint = escalationHint(item);

                                return (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            {item.patientCode ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">{item.parameterName ?? '—'}</td>
                                        <td className="px-4 py-3 font-semibold text-slate-900">
                                            {item.resultValue ?? '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${flag.className}`}>
                                                {flag.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>
                                                {status.label}
                                            </span>
                                            {(item.escalationLevel ?? 0) > 0 && (
                                                <span className="ml-2 text-xs text-red-600">
                                                    level {item.escalationLevel}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{formatDateTime(item.raisedAt)}</td>
                                        <td className={`px-4 py-3 text-xs ${hint.className}`}>{hint.text}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => openDialog(item)}
                                                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                                            >
                                                Acknowledge
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
                        <div className="border-b border-slate-200 px-6 py-4">
                            <h2 className="text-lg font-semibold text-slate-900">Acknowledge critical value</h2>
                            <p className="mt-1 text-sm text-slate-600">
                                {selected.parameterName ?? 'Result'} ={' '}
                                <span className="font-semibold text-slate-900">{selected.resultValue ?? '—'}</span>
                                {' '}for patient {selected.patientCode ?? '—'}
                            </p>
                        </div>

                        <div className="space-y-4 px-6 py-4">
                            <div>
                                <label htmlFor="readBack" className="block text-sm font-medium text-slate-700">
                                    Read-back <span className="text-red-600">*</span>
                                </label>
                                <p className="mb-1 text-xs text-slate-500">
                                    Type what the clinician repeated back to you, including the value.
                                </p>
                                <textarea
                                    id="readBack"
                                    rows={3}
                                    value={readBackText}
                                    onChange={(event) => setReadBackText(event.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                    placeholder={`e.g. "${selected.parameterName ?? 'Result'} ${selected.resultValue ?? ''}, confirmed"`}
                                />
                                {readBackMissingValue && (
                                    <p className="mt-1 text-xs text-amber-700">
                                        The read-back does not contain {selected.resultValue}. Confirm the
                                        clinician repeated the actual value.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="communicatedTo" className="block text-sm font-medium text-slate-700">
                                    Communicated to
                                </label>
                                <input
                                    id="communicatedTo"
                                    type="text"
                                    value={communicatedTo}
                                    onChange={(event) => setCommunicatedTo(event.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                                    placeholder="Name and role of the clinician called"
                                />
                            </div>

                            <label className="flex items-start gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={readBackVerified}
                                    onChange={(event) => setReadBackVerified(event.target.checked)}
                                    className="mt-0.5"
                                />
                                <span>I confirm the clinician repeated the value back correctly.</span>
                            </label>

                            {submitError && (
                                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                    {submitError}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
                            <button
                                type="button"
                                onClick={closeDialog}
                                disabled={submitting}
                                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void submit()}
                                disabled={submitting || !readBackText.trim()}
                                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {submitting ? 'Acknowledging…' : 'Acknowledge'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
