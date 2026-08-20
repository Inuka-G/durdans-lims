'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Barcode, Printer, RefreshCw, SearchX } from 'lucide-react';
import { getCollectionHistory, printSampleLabel } from '@/lib/api';
import { getBarcodeBars, openPhlebotomySpecimenLabelPrint } from '@/lib/phlebotomy-label-print';
import { TUBE_COLOR_MAP } from '@/constants/sample-lifecycle';
import type { LabelItem } from '@/types/sample-lifecycle';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import { InputField } from '@/components/ui/Field';

type LabelRow = LabelItem & {
    sampleUuid: string;
    tubeTypeCode: string;
};

type CollectionHistoryApiItem = {
    id?: string;
    sampleId?: string;
    patientName?: string;
    pid?: string;
    testCodes?: string[];
    tubeType?: string;
    tubeTypes?: string[];
    status?: string;
    collectedAt?: string;
    printCount?: number;
};

const SKELETON_CARDS = 4;
const GRID_CLASS = 'grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3';

function formatCollectedAt(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    // Always show date + time: collection time matters for audit, and the
    // Today/Yesterday relative forms are reserved for activity feeds.
    const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${time}`;
}

function LabelPrintPageInner() {
    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState(() => searchParams.get('sampleId') ?? '');
    const [labels, setLabels] = useState<LabelRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);

    const loadLabels = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const data = await getCollectionHistory(0, 100);
            const historyItems = (data?.content ?? data ?? []) as CollectionHistoryApiItem[];
            const rows: LabelRow[] = historyItems
                .filter((item) => item?.status === 'COLLECTED')
                .map((item) => {
                    const tubeTypeCode = item?.tubeType ?? item?.tubeTypes?.[0] ?? 'OTHER';
                    return {
                        id: String(item?.id ?? item?.sampleId ?? ''),
                        sampleUuid: String(item?.id ?? ''),
                        sampleId: item?.sampleId ?? '-',
                        patientName: item?.patientName ?? '-',
                        pid: item?.pid ?? '-',
                        testCodes: Array.isArray(item?.testCodes) ? item.testCodes : [],
                        tubeType: String(tubeTypeCode).replace(/_/g, ' '),
                        tubeColor: TUBE_COLOR_MAP[String(tubeTypeCode)] ?? TUBE_COLOR_MAP.OTHER,
                        collectedAt: formatCollectedAt(item?.collectedAt),
                        printCount: Number(item?.printCount ?? 0),
                        tubeTypeCode: String(tubeTypeCode),
                    };
                });
            setLabels(rows);
        } catch (error) {
            console.error('Failed to load label list:', error);
            toast.error('Failed to load labels. Please try again.');
            setLabels([]);
            setLoadError("Couldn't load labels");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadLabels();
    }, [loadLabels]);

    const filtered = useMemo(() =>
        labels.filter((l) => {
            const q = searchQuery.toLowerCase();
            return !q || l.sampleId.toLowerCase().includes(q) || l.patientName.toLowerCase().includes(q) || l.pid.toLowerCase().includes(q);
        }), [labels, searchQuery]);

    const handlePrint = async (label: LabelRow) => {
        try {
            setLoadingSampleId(label.sampleUuid);
            const updated = await printSampleLabel(label.sampleUuid);
            const nextCount = Number((updated as { printCount?: number })?.printCount ?? label.printCount + 1);

            const tubeCode = label.tubeTypeCode;
            const opened = openPhlebotomySpecimenLabelPrint({
                sampleId: label.sampleId,
                patientName: label.patientName,
                pid: label.pid,
                testCodes: label.testCodes,
                tubeTypeLabel: tubeCode,
            });

            if (!opened) {
                toast.error('Print window was blocked. Allow pop-ups for this site and try again.');
                return;
            }

            setLabels((current) =>
                current.map((item) =>
                    item.sampleUuid === label.sampleUuid ? { ...item, printCount: nextCount } : item
                )
            );
        } catch (error) {
            console.error('Failed to print label:', error);
            toast.error('Could not save label print count or open the printer. Please try again.');
        } finally {
            setLoadingSampleId(null);
        }
    };

    const searched = searchQuery.trim().length > 0;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                crumbs={[{ label: 'Phlebotomy', href: '/phlebotomy/worklist' }, { label: 'Label print' }]}
                title="Label print"
                meta={<span>Search and print sample barcode labels. Each print is recorded for audit.</span>}
                actions={
                    <Button icon={RefreshCw} onClick={() => void loadLabels()} loading={loading}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading labels'
                    : loadError
                      ? 'Labels failed to load'
                      : `${filtered.length} of ${labels.length} collected ${labels.length === 1 ? 'sample' : 'samples'} shown`}
            </p>

            {/* Search */}
            <div className="mb-4 rounded-lg border border-edge bg-surface p-4" role="search">
                <InputField
                    label="Search labels"
                    hideLabel
                    type="search"
                    name="label-search"
                    autoComplete="off"
                    placeholder="Sample ID, patient ID or patient name"
                    hint="Filters the collected samples below as you type."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Labels */}
            <SectionCard title="Collected samples" count={loading ? undefined : filtered.length} flush>
                <div aria-busy={loading}>
                    {loading ? (
                        <ul aria-hidden="true" className={GRID_CLASS}>
                            {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
                                <li key={i} className="rounded-md border border-edge p-4">
                                    <span className="block h-3.5 w-32 rounded bg-skeleton" />
                                    <span className="mt-2 block h-3 w-48 max-w-full rounded bg-skeleton" />
                                    <span className="mt-3 block h-16 rounded bg-skeleton" />
                                    <span className="ml-auto mt-3 block h-7 w-24 rounded bg-skeleton" />
                                </li>
                            ))}
                        </ul>
                    ) : loadError ? (
                        <EmptyState
                            icon={AlertTriangle}
                            title={loadError}
                            description="Check your connection and try again."
                            action={
                                <Button size="sm" onClick={() => void loadLabels()}>
                                    Retry
                                </Button>
                            }
                        />
                    ) : filtered.length === 0 ? (
                        searched ? (
                            <EmptyState
                                icon={SearchX}
                                title={`No labels match "${searchQuery.trim()}"`}
                                description="Check the sample ID, patient ID or patient name."
                                action={
                                    <Button size="sm" onClick={() => setSearchQuery('')}>
                                        Clear search
                                    </Button>
                                }
                            />
                        ) : (
                            <EmptyState
                                icon={Barcode}
                                title="No labels to print"
                                description="Samples appear here once they are collected in the worklist."
                            />
                        )
                    ) : (
                        <ul className={GRID_CLASS}>
                            {filtered.map((label) => {
                                const printing = loadingSampleId === label.sampleUuid;
                                return (
                                    <li key={label.id} className="flex flex-col rounded-md border border-edge bg-surface p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate font-mono text-sm font-semibold text-fg">{label.sampleId}</p>
                                                <p className="truncate text-xs text-fg-muted">
                                                    {label.patientName}
                                                    <span className="text-fg-faint"> · </span>
                                                    {label.pid}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1.5 text-xs text-fg-muted">
                                                <span className={`h-3 w-3 rounded-full ${label.tubeColor} ring-2 ring-surface`} aria-hidden="true" />
                                                <span>{label.tubeType}</span>
                                            </div>
                                        </div>

                                        {/* Label preview mimics the physical white label, so it stays black-on-white in both themes. */}
                                        <div className="mt-3 rounded-md border border-dashed border-edge-strong bg-white p-3 text-black">
                                            <span className="sr-only">Label preview: </span>
                                            <div className="flex items-center gap-3">
                                                <span className={`h-10 w-2.5 shrink-0 rounded-full ${label.tubeColor}`} aria-hidden="true" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-mono text-xs font-bold">{label.sampleId}</p>
                                                    <p className="truncate text-[10px] text-black/70">{label.patientName}</p>
                                                    {label.testCodes.length > 0 && (
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            {label.testCodes.map((c) => (
                                                                <span
                                                                    key={c}
                                                                    className="rounded border border-black/20 bg-white px-1 py-0.5 text-[9px] font-medium leading-none text-black"
                                                                >
                                                                    {c}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex shrink-0 gap-px" aria-hidden="true">
                                                    {getBarcodeBars(label.sampleId, 20).map((width, i) => (
                                                        <span key={i} className="block bg-black" style={{ width, height: 28 }} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-3">
                                            <p className="min-w-0 truncate text-xs tabular-nums text-fg-muted">
                                                Collected {label.collectedAt}
                                                <span className="text-fg-faint"> · </span>
                                                Printed {label.printCount}×
                                            </p>
                                            <Button
                                                size="sm"
                                                icon={Printer}
                                                loading={printing}
                                                aria-label={`Print label ${label.sampleId}`}
                                                onClick={() => void handlePrint(label)}
                                            >
                                                {printing ? 'Printing…' : 'Print label'}
                                            </Button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </SectionCard>
        </div>
    );
}

export default function LabelPrintPage() {
    // useSearchParams needs a Suspense boundary for static prerendering.
    return (
        <Suspense fallback={null}>
            <LabelPrintPageInner />
        </Suspense>
    );
}
