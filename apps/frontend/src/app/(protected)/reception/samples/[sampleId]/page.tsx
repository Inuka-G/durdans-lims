'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AxiosError } from 'axios';
import { AlertTriangle, ArrowLeft, BadgeCheck, Info } from 'lucide-react';
import { getReceptionSampleDetail, type SpecimenSampleDetail } from '@/lib/api';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip, { humanizeStatus } from '@/components/ui/StatusChip';
import StatusBadge from '@/components/shared/StatusBadge';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatRegistered } from '@/components/patient-dashboard/dashboard-data';
import { cn } from '@/lib/utils';

const WORKLIST_HREF = '/reception/accessioning';
const CRUMBS = [
    { label: 'Lab reception', href: WORKLIST_HREF },
    { label: 'Reception worklist', href: WORKLIST_HREF },
    { label: 'Sample details' },
];

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

const LINK_CLASS =
    'rounded font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

function DetailItem({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
    return (
        <div className={cn('min-w-0', className)}>
            <dt className="text-xs text-fg-muted">{label}</dt>
            <dd className="mt-0.5 break-words text-sm text-fg">{children}</dd>
        </div>
    );
}

export default function ReceptionSampleDetailPage() {
    const params = useParams();
    const sampleUuid = typeof params.sampleId === 'string' ? params.sampleId : '';

    const [detail, setDetail] = useState<SpecimenSampleDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sampleUuid) {
            setLoading(false);
            setError('Missing sample identifier.');
            return;
        }

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);

            try {
                const data = await getReceptionSampleDetail(sampleUuid);
                if (!cancelled) {
                    setDetail(data);
                }
            } catch (err) {
                console.error('Failed to load reception sample detail', err);
                if (!cancelled) {
                    setDetail(null);
                    setError(getApiErrorMessage(err, 'Unable to load this sample. It may have been removed or you may lack access.'));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [sampleUuid]);

    const isCollected = detail?.status === 'COLLECTED';
    const isRejected = detail?.status === 'REJECTED';
    const verifyHref = `/reception/quality-verification?sampleId=${sampleUuid}`;

    const patientMeta = detail
        ? [detail.patient?.pid, detail.patient?.gender, detail.patient?.age != null ? `${detail.patient.age} yrs` : null]
              .filter(Boolean)
              .join(' · ')
        : '';

    return (
        <div className="mx-auto max-w-5xl">
            <PageHeader
                crumbs={CRUMBS}
                title={
                    detail ? (
                        <span className="inline-flex flex-wrap items-center gap-2">
                            <span className="font-mono tabular-nums">{detail.sampleId}</span>
                            <StatusBadge status={detail.status} />
                            <PriorityBadge priority={detail.priority} />
                        </span>
                    ) : (
                        'Sample details'
                    )
                }
                meta={<span>Chain-of-custody summary for specimens handled at lab reception.</span>}
                actions={
                    <>
                        <Button icon={ArrowLeft} href={WORKLIST_HREF}>
                            Back to worklist
                        </Button>
                        {detail && isCollected && (
                            <Button variant="primary" icon={BadgeCheck} href={verifyHref}>
                                Verify sample
                            </Button>
                        )}
                    </>
                }
            />

            {/* Live region for async state changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading ? 'Loading sample' : detail ? `Sample ${detail.sampleId} loaded.` : ''}
            </p>

            {loading ? (
                <div className="grid animate-pulse grid-cols-1 gap-4 lg:grid-cols-3" aria-hidden="true">
                    <div className="space-y-4 lg:col-span-2">
                        <div className="h-44 overflow-hidden rounded-lg border border-edge bg-surface p-4">
                            <span className="block h-4 w-24 rounded bg-skeleton" />
                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <span className="block h-3 w-24 rounded bg-skeleton" />
                                    <span className="block h-4 w-40 rounded bg-skeleton" />
                                </div>
                                <div className="space-y-2">
                                    <span className="block h-3 w-24 rounded bg-skeleton" />
                                    <span className="block h-4 w-40 rounded bg-skeleton" />
                                </div>
                                <div className="space-y-2">
                                    <span className="block h-3 w-24 rounded bg-skeleton" />
                                    <span className="block h-4 w-40 rounded bg-skeleton" />
                                </div>
                                <div className="space-y-2">
                                    <span className="block h-3 w-24 rounded bg-skeleton" />
                                    <span className="block h-4 w-40 rounded bg-skeleton" />
                                </div>
                            </div>
                        </div>
                        <div className="h-24 overflow-hidden rounded-lg border border-edge bg-surface p-4">
                            <span className="block h-4 w-24 rounded bg-skeleton" />
                            <span className="mt-4 block h-4 w-40 rounded bg-skeleton" />
                        </div>
                    </div>
                    <div className="h-40 overflow-hidden rounded-lg border border-edge bg-surface p-4">
                        <span className="block h-4 w-24 rounded bg-skeleton" />
                        <div className="mt-4 space-y-2">
                            <span className="block h-3 w-24 rounded bg-skeleton" />
                            <span className="block h-4 w-40 rounded bg-skeleton" />
                        </div>
                    </div>
                </div>
            ) : error ? (
                <SectionCard title="Sample">
                    <div role="alert">
                        <EmptyState
                            icon={AlertTriangle}
                            title="Couldn't load this sample"
                            description={error}
                            action={
                                <Button icon={ArrowLeft} href={WORKLIST_HREF}>
                                    Back to worklist
                                </Button>
                            }
                        />
                    </div>
                </SectionCard>
            ) : detail ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="space-y-4 lg:col-span-2">
                        <SectionCard title="Specimen">
                            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <DetailItem label="Barcode">
                                    <span className="break-all font-mono font-semibold text-primary-strong">{detail.sampleId}</span>
                                </DetailItem>
                                <DetailItem label="Order">
                                    <span className="font-medium tabular-nums">{detail.orderId ?? '—'}</span>
                                </DetailItem>
                                <DetailItem label="Test">
                                    <span className="font-medium">{detail.testType ?? '—'}</span>
                                </DetailItem>
                                <DetailItem label="Collected">
                                    <span className="tabular-nums">{formatTs(detail.collectedAt)}</span>
                                </DetailItem>
                                <DetailItem label="Collected by">
                                    <span className="block truncate">{detail.collectedBy ?? '—'}</span>
                                </DetailItem>
                                <DetailItem label="Label prints recorded">
                                    <span className="tabular-nums">{detail.printCount}</span>
                                </DetailItem>
                                {detail.tubeTypes && detail.tubeTypes.length > 0 && (
                                    <DetailItem label="Container">
                                        <span className="flex flex-wrap gap-1.5">
                                            {detail.tubeTypes.map((tube) => (
                                                <StatusChip key={tube} tone="neutral">
                                                    {tube.replace(/_/g, ' ')}
                                                </StatusChip>
                                            ))}
                                        </span>
                                    </DetailItem>
                                )}
                            </dl>
                        </SectionCard>

                        {isCollected && (
                            <div className="flex items-start gap-2 rounded-lg border border-edge bg-surface-muted px-4 py-3 text-sm text-fg-secondary">
                                <Info className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                                <p>
                                    This specimen is awaiting pre-analytical verification. Use{' '}
                                    <Link href={verifyHref} className={LINK_CLASS}>
                                        Verify sample
                                    </Link>{' '}
                                    to complete checks before accepting or rejecting. Damaged labels can be addressed from{' '}
                                    <Link
                                        href={`/reception/barcode-print?query=${encodeURIComponent(detail.sampleId)}&returnTo=/reception/samples/${sampleUuid}`}
                                        className={LINK_CLASS}
                                    >
                                        Barcode print
                                    </Link>
                                    .
                                </p>
                            </div>
                        )}

                        {isRejected && (
                            <SectionCard title="Rejection details">
                                <div role="alert" className="rounded-md bg-status-danger-bg p-3 ring-1 ring-inset ring-status-danger-edge">
                                    <p className="text-sm text-status-danger-fg">
                                        Reason:{' '}
                                        <span className="font-semibold">
                                            {detail.rejectionReason ? humanizeStatus(detail.rejectionReason) : 'Not recorded'}
                                        </span>
                                    </p>
                                    {detail.rejectionNotes ? (
                                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-fg">{detail.rejectionNotes}</p>
                                    ) : (
                                        <p className="mt-2 text-xs text-fg-muted">No additional notes were captured.</p>
                                    )}
                                </div>
                            </SectionCard>
                        )}
                    </div>

                    <div className="space-y-4">
                        <SectionCard title="Patient">
                            <dl className="space-y-4">
                                <DetailItem label="Name">
                                    <span className="block truncate font-medium">{detail.patient?.name ?? '—'}</span>
                                </DetailItem>
                                <DetailItem label="Details">
                                    <span className="block truncate text-fg-secondary">{patientMeta || '—'}</span>
                                </DetailItem>
                                {detail.patient?.wardRoom && (
                                    <DetailItem label="Ward / room">
                                        <span className="block truncate">{detail.patient.wardRoom}</span>
                                    </DetailItem>
                                )}
                            </dl>
                        </SectionCard>
                    </div>
                </div>
            ) : (
                <SectionCard title="Sample">
                    <EmptyState icon={AlertTriangle} title="No data" description="Nothing was returned for this sample." />
                </SectionCard>
            )}
        </div>
    );
}

function getApiErrorMessage(error: unknown, fallback: string) {
    if (error instanceof AxiosError) {
        const msg = error.response?.data?.message;
        if (typeof msg === 'string' && msg.trim()) {
            return msg;
        }
    }
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }
    return fallback;
}
