'use client';

import { MOCK_INSTRUMENT_STATUS_FALLBACK } from '@/mock/mlt.mock';
import { getInstruments, syncInstrument, type InstrumentStatusItem } from '@/lib/api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Cpu, Microscope, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip, { humanizeStatus, type ChipTone } from '@/components/ui/StatusChip';
import StatCard from '@/components/shared/StatCard';
import DemoDataBanner from '@/components/shared/DemoDataBanner';

const SKELETON_CARDS = 4;

/** Instrument connectivity → chip tone. */
const INSTRUMENT_TONE: Record<InstrumentStatusItem['status'], ChipTone> = {
    online: 'success',
    offline: 'danger',
    busy: 'pending',
};

/** QC outcome → chip tone (PASS / WARN / FAIL are not part of the shared STATUS_TONE map). */
const QC_TONE: Record<InstrumentStatusItem['qcStatus'], ChipTone> = {
    PASS: 'success',
    WARN: 'pending',
    FAIL: 'danger',
};

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
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                crumbs={[{ label: 'Laboratory' }, { label: 'Equipment' }]}
                title="Instruments"
                meta={
                    loading ? (
                        <span>Loading analyser status…</span>
                    ) : (
                        <>
                            <span>
                                {instruments.length} {instruments.length === 1 ? 'analyser' : 'analysers'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{online} online</span>
                        </>
                    )
                }
                actions={
                    <Button icon={RefreshCw} loading={loading} onClick={loadInstruments}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading instruments'
                    : syncingId
                      ? 'Syncing instrument'
                      : `Instruments loaded. ${instruments.length} analysers, ${online} online, ${offline} offline.`}
            </p>

            {demoMode && (
                <DemoDataBanner note="Instrument middleware offline — showing mock analyser status for classroom / demo use. Live deployments pull ASTM / HL7 / vendor middleware queues; sync updates the last handshake timestamp only." />
            )}

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label="Instruments" value={instruments.length} icon={Microscope} color="blue" loading={loading} />
                <StatCard label="Online" value={online} icon={Wifi} color="emerald" loading={loading} />
                <StatCard
                    label="Offline"
                    value={offline}
                    icon={WifiOff}
                    color={offline > 0 ? 'red' : 'blue'}
                    sub={offline > 0 ? 'Check middleware connection' : undefined}
                    loading={loading}
                />
            </div>

            {error && !demoMode && (
                <div
                    role="alert"
                    className="mb-4 flex items-center gap-2 rounded-md border border-status-danger-edge bg-status-danger-bg px-4 py-2.5 text-sm text-status-danger-fg"
                >
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {error}
                </div>
            )}

            {loading ? (
                <div aria-hidden="true" className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
                        <div key={i} className="rounded-lg border border-edge bg-surface">
                            <div className="flex items-center justify-between border-b border-edge px-4 py-3">
                                <span className="h-4 w-36 rounded bg-skeleton" />
                                <span className="h-4 w-14 rounded bg-skeleton" />
                            </div>
                            <div className="space-y-3 p-4">
                                <span className="block h-3 w-28 rounded bg-skeleton" />
                                <div className="grid grid-cols-2 gap-3">
                                    <span className="h-3 w-full rounded bg-skeleton" />
                                    <span className="h-3 w-full rounded bg-skeleton" />
                                    <span className="h-3 w-3/4 rounded bg-skeleton" />
                                    <span className="h-3 w-3/4 rounded bg-skeleton" />
                                </div>
                                <div className="flex items-center justify-between border-t border-edge pt-3">
                                    <span className="h-6 w-24 rounded bg-skeleton" />
                                    <span className="h-7 w-16 rounded bg-skeleton" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : instruments.length === 0 ? (
                <div className="rounded-lg border border-edge bg-surface">
                    <EmptyState
                        icon={Cpu}
                        title="No instruments registered"
                        description="Analysers connected through the instrument middleware will appear here."
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={loadInstruments}>
                                Refresh
                            </Button>
                        }
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {instruments.map((instrument) => {
                        const syncing = syncingId === instrument.id;
                        return (
                            <SectionCard
                                key={instrument.id}
                                title={instrument.name}
                                actions={
                                    <StatusChip tone={INSTRUMENT_TONE[instrument.status]} dot>
                                        {humanizeStatus(instrument.status)}
                                    </StatusChip>
                                }
                            >
                                <p className="mb-3 flex items-center gap-1.5 text-xs text-fg-muted">
                                    <Cpu className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                                    <span className="truncate">{instrument.type}</span>
                                </p>

                                <dl className="mb-4 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                                    <div className="flex min-w-0 gap-1.5">
                                        <dt className="shrink-0 text-fg-muted">Model</dt>
                                        <dd className="truncate font-medium text-fg" title={instrument.model}>
                                            {instrument.model}
                                        </dd>
                                    </div>
                                    <div className="flex min-w-0 gap-1.5">
                                        <dt className="shrink-0 text-fg-muted">Serial</dt>
                                        <dd className="truncate font-medium tabular-nums text-fg" title={instrument.serial}>
                                            {instrument.serial}
                                        </dd>
                                    </div>
                                    <div className="flex min-w-0 gap-1.5">
                                        <dt className="shrink-0 text-fg-muted">Location</dt>
                                        <dd className="truncate font-medium text-fg" title={instrument.location}>
                                            {instrument.location}
                                        </dd>
                                    </div>
                                    <div className="flex min-w-0 gap-1.5">
                                        <dt className="shrink-0 text-fg-muted">Last sync</dt>
                                        <dd className="truncate font-medium text-fg" title={instrument.lastSync}>
                                            {instrument.lastSync}
                                        </dd>
                                    </div>
                                </dl>

                                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-3">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <p className="text-lg font-semibold leading-none tabular-nums text-fg">
                                                {instrument.testsToday}
                                            </p>
                                            <p className="mt-1 text-xs text-fg-muted">Tests today</p>
                                        </div>
                                        <div aria-hidden="true" className="h-8 w-px bg-edge" />
                                        <div>
                                            <p className="mb-1 text-xs text-fg-muted">QC status</p>
                                            <StatusChip tone={QC_TONE[instrument.qcStatus]} dot size="sm">
                                                {humanizeStatus(instrument.qcStatus)}
                                            </StatusChip>
                                        </div>
                                    </div>

                                    <Button
                                        size="sm"
                                        icon={RefreshCw}
                                        loading={syncing}
                                        onClick={() => handleSync(instrument.id)}
                                        aria-label={`${syncing ? 'Syncing' : 'Sync'} ${instrument.name}`}
                                    >
                                        {syncing ? 'Syncing…' : 'Sync'}
                                    </Button>
                                </div>
                            </SectionCard>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
