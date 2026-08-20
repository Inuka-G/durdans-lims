'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, FileQuestion, Printer, RefreshCw } from 'lucide-react';
import { getPhlebotomySampleDetail, printSampleLabel } from '@/lib/api';
import { getBarcodeBars, getTubeHexColor, openPhlebotomySpecimenLabelPrint } from '@/lib/phlebotomy-label-print';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip, { type ChipTone, humanizeStatus, toneForStatus } from '@/components/ui/StatusChip';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatRegistered } from '@/components/patient-dashboard/dashboard-data';

type SampleDetail = {
    id?: string;
    sampleId?: string;
    orderId?: string | null;
    status?: string;
    priority?: string;
    testType?: string | null;
    testCodes?: string[];
    tubeTypes?: string[];
    /** Hex cap colour of the stocked container this sample was drawn into (supplies inventory). */
    tubeColor?: string | null;
    collectedAt?: string | null;
    collectedBy?: string | null;
    rejectionReason?: string | null;
    rejectionNotes?: string | null;
    printCount?: number;
    patient?: {
        pid?: string | null;
        name?: string | null;
        age?: number | null;
        gender?: string | null;
    };
};

const HISTORY_HREF = '/phlebotomy/collection-history';

/** "Today 09:12", "Yesterday 14:02", otherwise "16 Aug 2026 09:12". */
function formatTs(iso?: string | null) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const label = formatRegistered(d);
    if (label.startsWith('Today') || label.startsWith('Yesterday')) return label;
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${label} ${time}`;
}

/** Collection statuses → chip tone. RECOLLECTION_REQUIRED is not in STATUS_TONE yet, so it is mapped here. */
function sampleTone(status?: string | null): ChipTone {
    if (status === 'RECOLLECTION_REQUIRED') return 'pending';
    return toneForStatus(status);
}

const TIMELINE_DOT: Record<ChipTone, string> = {
    neutral: 'bg-fg-faint',
    pending: 'bg-status-pending',
    success: 'bg-status-verified',
    danger: 'bg-status-danger',
    info: 'bg-primary',
};

type TimelineStep = {
    key: string;
    title: string;
    detail: string;
    meta?: string;
    tone: ChipTone;
};

function DetailItem({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
    return (
        <div className={cn('min-w-0', className)}>
            <dt className="text-xs text-fg-muted">{label}</dt>
            <dd className="mt-0.5 break-words text-sm text-fg">{children}</dd>
        </div>
    );
}

export default function CollectionSampleDetailPage() {
    const params = useParams();
    const router = useRouter();
    const sampleUuid = typeof params.sampleUuid === 'string' ? params.sampleUuid : '';

    const [detail, setDetail] = useState<SampleDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [printing, setPrinting] = useState(false);

    const load = useCallback(async () => {
        if (!sampleUuid) return;
        try {
            setLoading(true);
            setError(null);
            const data = await getPhlebotomySampleDetail(sampleUuid);
            setDetail(data as SampleDetail);
        } catch (e) {
            console.error(e);
            setError('Unable to load this sample. It may have been removed or you may not have access.');
            setDetail(null);
        } finally {
            setLoading(false);
        }
    }, [sampleUuid]);

    useEffect(() => {
        void load();
    }, [load]);

    const handlePrintLabel = async () => {
        if (!detail?.sampleId || detail.status !== 'COLLECTED') {
            return;
        }
        try {
            setPrinting(true);
            const updated = await printSampleLabel(sampleUuid);
            const tubeCode = detail.tubeTypes?.[0] ?? 'OTHER';
            const opened = openPhlebotomySpecimenLabelPrint({
                sampleId: detail.sampleId,
                patientName: detail.patient?.name ?? '—',
                pid: detail.patient?.pid ?? '—',
                testCodes: Array.isArray(detail.testCodes) ? detail.testCodes : [],
                tubeTypeLabel: String(tubeCode),
                // Printed strip/dot must match the physical cap the specimen is in.
                tubeColor: detail.tubeColor,
            });
            if (!opened) {
                toast.error('Print window was blocked. Allow pop-ups for this site and try again.');
            }
            const next = updated as SampleDetail | undefined;
            if (next && typeof next.printCount === 'number') {
                setDetail((prev) => (prev ? { ...prev, printCount: next.printCount } : prev));
            }
        } catch (e) {
            console.error(e);
            toast.error('Could not record label print. Please try again.');
        } finally {
            setPrinting(false);
        }
    };

    if (!sampleUuid) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader crumbs={[{ label: 'Phlebotomy', href: '/phlebotomy/worklist' }, { label: 'Collection history', href: HISTORY_HREF }, { label: 'Sample' }]} title="Sample detail" />
                <SectionCard title="Sample">
                    <EmptyState
                        icon={FileQuestion}
                        title="Missing sample reference"
                        description="Open a sample from the collection history list."
                        action={
                            <Button icon={ArrowLeft} href={HISTORY_HREF}>
                                Back to history
                            </Button>
                        }
                    />
                </SectionCard>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl">
                <p role="status" aria-live="polite" className="sr-only">Loading sample</p>
                <div className="mb-5" aria-hidden="true">
                    <span className="mb-2 block h-3 w-48 rounded bg-skeleton" />
                    <span className="block h-6 w-40 rounded bg-skeleton" />
                    <span className="mt-2 block h-3 w-72 max-w-full rounded bg-skeleton" />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-hidden="true">
                    <div className="space-y-4 lg:col-span-2">
                        <div className="h-40 rounded-lg border border-edge bg-surface" />
                        <div className="h-40 rounded-lg border border-edge bg-surface" />
                    </div>
                    <div className="space-y-4">
                        <div className="h-56 rounded-lg border border-edge bg-surface" />
                        <div className="h-40 rounded-lg border border-edge bg-surface" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="mx-auto max-w-5xl">
                <PageHeader crumbs={[{ label: 'Phlebotomy', href: '/phlebotomy/worklist' }, { label: 'Collection history', href: HISTORY_HREF }, { label: 'Sample' }]} title="Sample detail" />
                <p role="alert" className="sr-only">{error ?? 'Sample not found.'}</p>
                <SectionCard title="Sample">
                    <EmptyState
                        icon={AlertTriangle}
                        title={error ?? 'Sample not found.'}
                        description="Go back to the list or try loading it again."
                        action={
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                <Button icon={ArrowLeft} onClick={() => router.push(HISTORY_HREF)}>
                                    Back to history
                                </Button>
                                <Button variant="ghost" icon={RefreshCw} onClick={() => void load()}>
                                    Retry
                                </Button>
                            </div>
                        }
                    />
                </SectionCard>
            </div>
        );
    }

    const tubeCode = detail.tubeTypes?.[0] ?? 'OTHER';
    /* Cap colour comes from the stocked tube in supplies, not from the tube code, so a branch
       that stocks a different container shows the tube the phlebotomist actually holds.
       Physical cap colours stay literal in both themes (see DESIGN.md); the helper falls back
       to neutral grey when no stocked container carries a colour. */
    const tubeColor = getTubeHexColor(detail.tubeColor);
    const tubeLabel = String(tubeCode).replace(/_/g, ' ');
    const sampleLabel = detail.sampleId ?? sampleUuid;
    const statusKey = detail.status ?? '';
    const printCount = detail.printCount ?? 0;
    const testCodes = detail.testCodes ?? [];

    const timeline: TimelineStep[] = [
        {
            key: 'collected',
            title: detail.collectedAt ? 'Specimen collected' : 'Collection not recorded',
            detail: formatTs(detail.collectedAt),
            meta: detail.collectedBy ? `by ${detail.collectedBy}` : undefined,
            tone: detail.collectedAt ? 'success' : 'neutral',
        },
        {
            key: 'label',
            title: printCount > 0 ? 'Label printed' : 'Label not printed',
            detail: printCount > 0 ? `${printCount}× recorded` : detail.status === 'COLLECTED' ? 'Print from this page when the tube is labelled' : 'Labels are issued for collected specimens only',
            tone: printCount > 0 ? 'info' : 'neutral',
        },
        {
            key: 'status',
            title: statusKey ? humanizeStatus(statusKey) : 'Status unknown',
            detail:
                detail.status === 'REJECTED'
                    ? detail.rejectionReason ?? 'No reason recorded'
                    : detail.status === 'COLLECTED'
                      ? 'Ready for transport to the laboratory'
                      : 'Current specimen status',
            tone: sampleTone(statusKey),
        },
    ];

    return (
        <div className="mx-auto max-w-5xl">
            <PageHeader
                crumbs={[{ label: 'Phlebotomy', href: '/phlebotomy/worklist' }, { label: 'Collection history', href: HISTORY_HREF }, { label: sampleLabel }]}
                title={
                    <span className="inline-flex flex-wrap items-center gap-2">
                        <span className="tabular-nums">{sampleLabel}</span>
                        <PriorityBadge priority={detail.priority ?? 'NORMAL'} />
                        <StatusChip tone={sampleTone(statusKey)} dot>
                            {statusKey ? humanizeStatus(statusKey) : '—'}
                        </StatusChip>
                    </span>
                }
                meta={<span>Specimen detail — bedside labels should match container type and test panel (ISO 15189 traceability).</span>}
                actions={
                    <>
                        <Button icon={ArrowLeft} onClick={() => router.push(HISTORY_HREF)}>
                            Back to history
                        </Button>
                        {detail.status === 'COLLECTED' && (
                            <Button variant="primary" icon={Printer} loading={printing} onClick={() => void handlePrintLabel()}>
                                {printing ? 'Printing…' : 'Print specimen label'}
                            </Button>
                        )}
                    </>
                }
            />

            <p role="status" aria-live="polite" className="sr-only">
                {printing ? 'Printing specimen label' : `Sample ${sampleLabel} loaded.`}
            </p>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                    <SectionCard title="Patient and order">
                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <DetailItem label="Patient">
                                <span className="block truncate font-medium">{detail.patient?.name ?? '—'}</span>
                                <span className="block text-xs text-fg-muted">{detail.patient?.pid ?? '—'}</span>
                            </DetailItem>
                            <DetailItem label="Order">
                                <span className="font-medium tabular-nums">{detail.orderId ?? '—'}</span>
                            </DetailItem>
                            <DetailItem label="Demographics">
                                {detail.patient?.age != null ? `${detail.patient.age} yrs` : '—'}
                                {detail.patient?.gender ? ` · ${detail.patient.gender}` : ''}
                            </DetailItem>
                            <DetailItem label="Status">
                                <StatusChip tone={sampleTone(statusKey)} dot>
                                    {statusKey ? humanizeStatus(statusKey) : '—'}
                                </StatusChip>
                            </DetailItem>
                        </dl>
                    </SectionCard>

                    <SectionCard title="Tests and container" count={testCodes.length}>
                        <div className="flex flex-wrap gap-1.5">
                            {testCodes.map((c) => (
                                <StatusChip key={c} tone="neutral">
                                    {c}
                                </StatusChip>
                            ))}
                            {testCodes.length === 0 && <span className="text-sm text-fg-muted">No test codes linked.</span>}
                        </div>
                        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <DetailItem label="Test panel">
                                <span className="font-medium">{detail.testType ?? '—'}</span>
                            </DetailItem>
                            <DetailItem label="Required tube">
                                <span className="inline-flex items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="h-8 w-3 shrink-0 rounded-full ring-1 ring-inset ring-edge"
                                        style={{ backgroundColor: tubeColor }}
                                    />
                                    <span className="font-medium">{tubeLabel}</span>
                                </span>
                            </DetailItem>
                        </dl>
                    </SectionCard>

                    {detail.status === 'REJECTED' && (
                        <SectionCard title="Rejection">
                            <div className="rounded-md bg-status-danger-bg p-3 ring-1 ring-inset ring-status-danger-edge">
                                <p className="break-words text-xs text-status-danger-fg">
                                    Reason: <span className="font-semibold">{detail.rejectionReason ?? '—'}</span>
                                </p>
                                {/* Free text typed by staff: keep real newlines, but still wrap a long unbroken token. */}
                                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-status-danger-fg">{detail.rejectionNotes ?? 'No notes recorded.'}</p>
                            </div>
                        </SectionCard>
                    )}
                </div>

                <div className="space-y-4">
                    <SectionCard title="Collection timeline">
                        <ol className="relative space-y-4 border-l border-edge pl-4">
                            {timeline.map((step) => (
                                <li key={step.key} className="relative">
                                    <span
                                        aria-hidden="true"
                                        className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface', TIMELINE_DOT[step.tone])}
                                    />
                                    <p className="text-sm font-medium text-fg">{step.title}</p>
                                    <p className="text-xs text-fg-secondary tabular-nums">{step.detail}</p>
                                    {step.meta && <p className="text-xs text-fg-muted">{step.meta}</p>}
                                </li>
                            ))}
                        </ol>
                        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-edge pt-3">
                            <DetailItem label="Collected by">
                                <span className="block truncate font-medium">{detail.collectedBy ?? '—'}</span>
                            </DetailItem>
                            <DetailItem label="Label prints">
                                <span className="font-medium tabular-nums">{printCount}×</span>
                            </DetailItem>
                        </dl>
                    </SectionCard>

                    <SectionCard title="Label preview">
                        {/* Mirrors the printed bedside label, so the strip carries the same stocked-tube hex. */}
                        <div className="flex items-center gap-3 rounded-md border border-edge bg-surface-muted p-3">
                            <span
                                aria-hidden="true"
                                className="h-12 w-3 shrink-0 rounded-full ring-1 ring-inset ring-edge"
                                style={{ backgroundColor: tubeColor }}
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-fg tabular-nums">{detail.sampleId}</p>
                                <p className="truncate text-[11px] text-fg-muted">{detail.patient?.name}</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {testCodes.slice(0, 4).map((c) => (
                                        <span key={c} className="rounded bg-surface-hover px-1 py-0.5 text-[10px] text-fg-secondary">
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex shrink-0 gap-[1px]" aria-hidden="true">
                                {getBarcodeBars(detail.sampleId ?? '', 18).map((width, i) => (
                                    <div key={i} className="rounded-[0.5px] bg-fg" style={{ width, height: 26 }} />
                                ))}
                            </div>
                        </div>
                        <p className="mt-2 text-[11px] text-fg-muted">Cap colour reflects the tube stocked at this branch.</p>
                        {detail.status !== 'COLLECTED' && (
                            <p className="mt-3 text-xs text-status-pending-fg">
                                Labels are only issued for collected specimens. Rejected tubes follow your laboratory&apos;s discard / documentation SOP.
                            </p>
                        )}
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}
