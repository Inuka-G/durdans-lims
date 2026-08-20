'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlarmClock, AlertTriangle, PhoneCall, RefreshCw, ShieldCheck, Siren } from 'lucide-react';
import {
    acknowledgeCriticalValue,
    getOpenCriticalValues,
    type CriticalNotification
} from '@/lib/api';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import KpiTile from '@/components/ui/KpiTile';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import StatusChip, { humanizeStatus, toneForStatus, type ChipTone } from '@/components/ui/StatusChip';
import { InputField, TextareaField } from '@/components/ui/Field';
import { formatRegistered } from '@/components/patient-dashboard/dashboard-data';

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
const SKELETON_ROWS = 4;

const FLAG_CONFIG: Record<string, { label: string; tone: ChipTone }> = {
    CRITICAL_LOW: { label: 'Critical low', tone: 'danger' },
    CRITICAL_HIGH: { label: 'Critical high', tone: 'danger' }
};

const STATUS_CONFIG: Record<string, { label: string; tone: ChipTone }> = {
    PENDING: { label: 'Awaiting call', tone: 'pending' },
    NOTIFIED: { label: 'Notified', tone: 'info' },
    ESCALATED: { label: 'Escalated', tone: 'danger' }
};

const toDate = (value?: string | null) => {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Full, unambiguous timestamp for tooltips. */
const formatFullTimestamp = (value?: string | null) => {
    const parsed = toDate(value);
    if (!parsed) {
        return value ?? '—';
    }
    return parsed.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
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
        return { text: '—', className: 'text-fg-faint' };
    }
    if (mins < 0) {
        return { text: `Overdue by ${Math.abs(mins)} min`, className: 'font-semibold text-status-danger-fg' };
    }
    if (mins <= 5) {
        return { text: `Escalates in ${mins} min`, className: 'font-semibold text-status-danger-fg' };
    }
    return { text: `Escalates in ${mins} min`, className: 'text-fg-secondary' };
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

    // Stable identity: Modal re-runs its focus/Esc effect when onClose changes,
    // which would otherwise steal focus from the read-back field on every keystroke.
    const closeDialog = useCallback(() => {
        setSelected(null);
        setSubmitError(null);
    }, []);

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
    const escalatedCount = items.filter((item) => (item.status ?? '').toUpperCase() === 'ESCALATED').length;
    const showSkeleton = loading && items.length === 0;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Critical values"
                crumbs={[{ label: 'Verification', href: '/verification/pending' }, { label: 'Critical values' }]}
                meta={
                    <>
                        <Siren className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                            Panic values awaiting a clinician callback. Each must be telephoned and acknowledged with a
                            read-back; unacknowledged callbacks escalate automatically.
                        </span>
                    </>
                }
                actions={
                    <Button icon={RefreshCw} onClick={() => void load(true)} loading={loading && items.length > 0}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading critical-value callbacks'
                    : error
                      ? 'Critical-value callbacks failed to load'
                      : `${items.length} open critical-value callbacks, ${overdueCount} overdue.`}
            </p>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <KpiTile
                    label="Open callbacks"
                    value={items.length}
                    icon={AlertTriangle}
                    tone={items.length > 0 ? 'danger' : 'neutral'}
                    note="Awaiting acknowledgement"
                    loading={showSkeleton}
                />
                <KpiTile
                    label="Overdue"
                    value={overdueCount}
                    icon={AlarmClock}
                    tone={overdueCount > 0 ? 'danger' : 'neutral'}
                    note="Past the escalation deadline"
                    loading={showSkeleton}
                />
                <KpiTile
                    label="Escalated"
                    value={escalatedCount}
                    icon={Siren}
                    tone={escalatedCount > 0 ? 'warning' : 'neutral'}
                    note="Passed to the fallback contact"
                    loading={showSkeleton}
                />
            </div>

            {error && (
                <div
                    role="alert"
                    className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-status-danger-edge bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg"
                >
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">{error}</span>
                    <Button size="sm" icon={RefreshCw} onClick={() => void load(true)}>
                        Retry
                    </Button>
                </div>
            )}

            <SectionCard title="Open callbacks" count={!showSkeleton ? items.length : undefined} flush>
                {showSkeleton ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                            <li key={index} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="h-3 w-24 shrink-0 rounded bg-skeleton" />
                                <span className="h-3 w-28 rounded bg-skeleton" />
                                <span className="h-3 w-12 rounded bg-skeleton" />
                                <span className="h-4 w-20 rounded bg-skeleton" />
                                <span className="hidden h-4 w-24 rounded bg-skeleton md:block" />
                                <span className="hidden h-3 w-28 rounded bg-skeleton lg:block" />
                                <span className="ml-auto h-7 w-28 shrink-0 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : items.length === 0 ? (
                    <EmptyState
                        icon={ShieldCheck}
                        title="No open critical-value callbacks"
                        description="Panic values raised by result entry, instrument ingestion or an amendment appear here."
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1104px] table-fixed text-left text-[13px]">
                            <caption className="sr-only">Open critical-value callbacks</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                    <th scope="col" className="w-32 py-2 pl-4 pr-3 font-medium">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-48 px-3 py-2 font-medium">
                                        Analyte
                                    </th>
                                    <th scope="col" className="w-24 px-3 py-2 font-medium">
                                        Value
                                    </th>
                                    <th scope="col" className="w-28 px-3 py-2 font-medium">
                                        Flag
                                    </th>
                                    <th scope="col" className="w-40 px-3 py-2 font-medium">
                                        Status
                                    </th>
                                    <th scope="col" className="hidden w-32 px-3 py-2 font-medium md:table-cell">
                                        Raised
                                    </th>
                                    <th scope="col" className="w-36 px-3 py-2 font-medium">
                                        Escalation
                                    </th>
                                    <th scope="col" className="w-36 py-2 pl-3 pr-4 text-right font-medium">
                                        <span className="sr-only">Action</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {items.map((item) => {
                                    const flagKey = (item.flag ?? '').toUpperCase();
                                    const flag = FLAG_CONFIG[flagKey] ?? {
                                        label: item.flag ? humanizeStatus(item.flag) : '—',
                                        tone: 'neutral' as ChipTone
                                    };
                                    const statusKey = (item.status ?? '').toUpperCase();
                                    const status = STATUS_CONFIG[statusKey] ?? {
                                        label: item.status ? humanizeStatus(item.status) : '—',
                                        tone: toneForStatus(statusKey)
                                    };
                                    const hint = escalationHint(item);
                                    const raisedAt = toDate(item.raisedAt);

                                    return (
                                        <tr key={item.id} className="transition-colors hover:bg-surface-hover">
                                            <td className="truncate py-2 pl-4 pr-3 font-mono text-xs font-medium text-fg" title={item.patientCode ?? undefined}>
                                                {item.patientCode ?? <span className="text-fg-faint">—</span>}
                                            </td>
                                            <td className="truncate px-3 py-2 text-fg-secondary" title={item.parameterName ?? undefined}>
                                                {item.parameterName ?? <span className="text-fg-faint">—</span>}
                                            </td>
                                            <td className="px-3 py-2 font-semibold tabular-nums text-fg">
                                                {item.resultValue ?? <span className="text-fg-faint">—</span>}
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusChip tone={flag.tone} size="sm" className="font-semibold">
                                                    {flag.label}
                                                </StatusChip>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="inline-flex items-center gap-2">
                                                    <StatusChip tone={status.tone} dot>
                                                        {status.label}
                                                    </StatusChip>
                                                    {(item.escalationLevel ?? 0) > 0 && (
                                                        <span className="text-xs text-status-danger-fg">
                                                            level {item.escalationLevel}
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="hidden px-3 py-2 tabular-nums text-fg-secondary md:table-cell">
                                                {raisedAt ? (
                                                    <time dateTime={item.raisedAt ?? undefined} title={formatFullTimestamp(item.raisedAt)}>
                                                        {formatRegistered(raisedAt)}
                                                    </time>
                                                ) : (
                                                    <span className="text-fg-faint">—</span>
                                                )}
                                            </td>
                                            <td className={`px-3 py-2 text-xs tabular-nums ${hint.className}`}>{hint.text}</td>
                                            <td className="py-2 pl-3 pr-4 text-right">
                                                <Button size="sm" icon={PhoneCall} onClick={() => openDialog(item)}>
                                                    Acknowledge
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            <Modal
                open={selected !== null}
                onClose={closeDialog}
                title="Acknowledge critical value"
                dismissible={!submitting}
                description={
                    selected ? (
                        <>
                            {selected.parameterName ?? 'Result'} ={' '}
                            <span className="font-semibold text-fg">{selected.resultValue ?? '—'}</span>
                            {' '}for patient {selected.patientCode ?? '—'}
                        </>
                    ) : undefined
                }
                footer={
                    <>
                        <Button onClick={closeDialog} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            icon={PhoneCall}
                            onClick={() => void submit()}
                            loading={submitting}
                            disabled={!readBackText.trim()}
                        >
                            Acknowledge
                        </Button>
                    </>
                }
            >
                {selected && (
                    <div className="space-y-4">
                        <div>
                            <TextareaField
                                id="readBack"
                                label="Read-back"
                                required
                                rows={3}
                                value={readBackText}
                                onChange={(event) => setReadBackText(event.target.value)}
                                hint="Type what the clinician repeated back to you, including the value."
                                placeholder={`e.g. "${selected.parameterName ?? 'Result'} ${selected.resultValue ?? ''}, confirmed"`}
                            />
                            {readBackMissingValue && (
                                <p role="status" className="mt-1 text-xs text-status-pending-fg">
                                    The read-back does not contain {selected.resultValue}. Confirm the clinician repeated the
                                    actual value.
                                </p>
                            )}
                        </div>

                        <InputField
                            id="communicatedTo"
                            label="Communicated to"
                            type="text"
                            value={communicatedTo}
                            onChange={(event) => setCommunicatedTo(event.target.value)}
                            placeholder="Name and role of the clinician called"
                        />

                        <label className="flex items-start gap-2 text-sm text-fg-secondary">
                            <input
                                type="checkbox"
                                checked={readBackVerified}
                                onChange={(event) => setReadBackVerified(event.target.checked)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-edge-strong accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
                            />
                            <span>I confirm the clinician repeated the value back correctly.</span>
                        </label>

                        {submitError && (
                            <div
                                role="alert"
                                className="rounded-md border border-status-danger-edge bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
                            >
                                {submitError}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
