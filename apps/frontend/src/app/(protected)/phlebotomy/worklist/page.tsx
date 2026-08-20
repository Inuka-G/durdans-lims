'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePathname, useRouter } from 'next/navigation';
import {
    AlertTriangle,
    Ban,
    ClipboardList,
    Clock,
    Play,
    RefreshCw,
    RotateCcw,
    Search,
    Siren,
} from 'lucide-react';
import { TUBE_COLOR_MAP, formatStatusLabel } from '@/constants/sample-lifecycle';
import { collectSample, getPhlebotomyStats, getPhlebotomyWorklist, rejectPhlebotomySample } from '@/lib/api';
import type { Sample, TubeType } from '@/types/sample-lifecycle';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import StatusChip from '@/components/ui/StatusChip';
import { SelectField, TextareaField } from '@/components/ui/Field';
import StatCard from '@/components/shared/StatCard';
import PriorityBadge from '@/components/shared/PriorityBadge';
import WorklistFilters from '@/components/phlebotomy/WorklistFilters';

const PAGE_SIZE = 8;
const SKELETON_ROWS = 6;
type RejectionReason = 'HEMOLYZED' | 'INSUFFICIENT_VOLUME' | 'WRONG_CONTAINER' | 'CLOTTED' | 'CONTAMINATED' | 'UNLABELED' | 'OTHER';
type PhlebotomyStats = {
    pendingCollections: number;
    normalPriority: number;
    statPriority: number;
    urgentPriority: number;
};
type RawWorklistItem = {
    id?: string | number;
    sampleId?: string | number;
    orderId?: string;
    patientId?: string | number;
    pid?: string;
    patientName?: string;
    age?: number | string;
    gender?: string;
    wardRoom?: string;
    patient?: {
        id?: string | number;
        pid?: string;
        name?: string;
        age?: number | string;
        gender?: string;
        wardRoom?: string;
    };
    testType?: string;
    testCodes?: string[];
    priority?: Sample['priority'];
    status?: Sample['status'];
    tubeTypes?: TubeType[];
    waitTimeMinutes?: number | string;
    waitTime?: number | string;
};

const REJECTION_REASON_OPTIONS: { value: RejectionReason; label: string }[] = [
    { value: 'HEMOLYZED', label: 'Hemolyzed' },
    { value: 'INSUFFICIENT_VOLUME', label: 'Insufficient volume' },
    { value: 'WRONG_CONTAINER', label: 'Wrong container' },
    { value: 'CLOTTED', label: 'Clotted' },
    { value: 'CONTAMINATED', label: 'Contaminated' },
    { value: 'UNLABELED', label: 'Unlabeled' },
    { value: 'OTHER', label: 'Other' },
];

function formatWaitTime(minutes?: number) {
    const totalMinutes = Math.max(0, Math.floor(minutes ?? 0));
    if (totalMinutes < 60) return `${totalMinutes} min`;

    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const remainingMinutes = totalMinutes % 60;
    if (days > 0) {
        const parts = [`${days}d`];
        if (hours > 0) parts.push(`${hours}h`);
        if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
        return parts.join(' ');
    }

    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function waitTimeTone(minutes?: number) {
    const value = minutes ?? 0;
    if (value > 30) return 'text-status-danger-fg';
    if (value > 15) return 'text-status-pending-fg';
    return 'text-fg-secondary';
}

function isRecollectionSample(sample: Sample) {
    return sample.status === 'RECOLLECTION_REQUIRED';
}

export default function PhlebotomyWorklistPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [searchQuery, setSearchQuery] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [worklist, setWorklist] = useState<Sample[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [stats, setStats] = useState<PhlebotomyStats>({
        pendingCollections: 0,
        normalPriority: 0,
        statPriority: 0,
        urgentPriority: 0,
    });
    const [rejectingSample, setRejectingSample] = useState<Sample | null>(null);
    const [rejectionReason, setRejectionReason] = useState<RejectionReason>('HEMOLYZED');
    const [rejectionNotes, setRejectionNotes] = useState('');
    const [rejectionError, setRejectionError] = useState('');

    const loadWorklist = useCallback(async () => {
        try {
            setIsLoading(true);
            setLoadError('');
            const [data, statsData] = await Promise.all([
                getPhlebotomyWorklist(0, 100),
                getPhlebotomyStats(),
            ]);
            const rawRows = data as { content?: RawWorklistItem[] } | RawWorklistItem[] | null | undefined;
            const rows: RawWorklistItem[] = Array.isArray(rawRows) ? rawRows : rawRows?.content ?? [];
            const list: Sample[] = rows.map((item) => ({
                id: String(item?.id ?? item?.sampleId ?? ''),
                sampleId: String(item?.sampleId ?? '-'),
                orderId: item?.orderId ?? '-',
                patient: {
                    id: String(item?.patient?.id ?? item?.patientId ?? ''),
                    pid: item?.patient?.pid ?? item?.pid ?? '-',
                    name: item?.patient?.name ?? item?.patientName ?? '-',
                    age: Number(item?.patient?.age ?? item?.age ?? 0),
                    gender: (item?.patient?.gender ?? item?.gender ?? 'M') === 'FEMALE' ? 'F' : ((item?.patient?.gender ?? item?.gender ?? 'M') === 'F' ? 'F' : 'M'),
                    wardRoom: item?.patient?.wardRoom ?? item?.wardRoom,
                },
                testType: item?.testType ?? (Array.isArray(item?.testCodes) ? item.testCodes.join(', ') : '-'),
                testCodes: Array.isArray(item?.testCodes) ? item.testCodes : [],
                priority: item?.priority ?? 'NORMAL',
                status: item?.status ?? 'PENDING_COLLECTION',
                tubeTypes: (Array.isArray(item?.tubeTypes) ? item.tubeTypes : ['OTHER']) as TubeType[],
                waitTimeMinutes: Number(item?.waitTimeMinutes ?? item?.waitTime ?? 0),
            }));
            setWorklist(list);
            setStats({
                pendingCollections: Number(statsData?.pendingCollections ?? 0),
                normalPriority: list.filter((sample) => sample.priority === 'NORMAL').length,
                statPriority: list.filter((sample) => sample.priority === 'STAT').length,
                urgentPriority: list.filter((sample) => sample.priority === 'URGENT').length,
            });
        } catch (error) {
            console.error('Failed to load phlebotomy worklist:', error);
            setLoadError("Couldn't load the worklist. Check your connection and retry.");
            setWorklist([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadWorklist();
    }, [loadWorklist, pathname]);

    const filtered = useMemo(() => {
        return worklist.filter((s) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q || s.patient.name.toLowerCase().includes(q) || s.patient.pid.toLowerCase().includes(q) || s.orderId.toLowerCase().includes(q);
            const matchesPriority = priorityFilter === 'ALL' || s.priority === priorityFilter;
            return matchesSearch && matchesPriority;
        });
    }, [worklist, searchQuery, priorityFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    // Clamp so a shrinking list (after collect / reject) never leaves the pager on an empty page.
    const page = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const hasFilters = Boolean(searchQuery) || priorityFilter !== 'ALL';

    const handleSearch = (q: string) => {
        setSearchQuery(q);
        setCurrentPage(1);
    };

    const handlePriorityChange = (p: string) => {
        setPriorityFilter(p);
        setCurrentPage(1);
    };

    const handleCollect = async (sampleUuid: string, sampleLabel: string) => {
        try {
            setActionLoadingId(sampleUuid);
            await collectSample(sampleUuid, {});
            await loadWorklist();
            router.push(`/phlebotomy/label-print?sampleId=${encodeURIComponent(sampleLabel)}`);
        } catch (error) {
            console.error(`Failed to collect sample ${sampleLabel}:`, error);
            toast.error('Failed to start collection. Please try again.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const openRejectForm = (sample: Sample) => {
        setRejectingSample(sample);
        setRejectionReason('HEMOLYZED');
        setRejectionNotes('');
        setRejectionError('');
    };

    // Stable so the Modal's focus/keyboard effect does not re-run on every keystroke.
    const closeRejectForm = useCallback(() => {
        setRejectingSample(null);
        setRejectionError('');
    }, []);

    const handleReject = async () => {
        if (!rejectingSample) return;
        const notes = rejectionNotes.trim();
        if (!notes) {
            setRejectionError('Please enter a rejection message.');
            return;
        }

        try {
            setRejectionError('');
            setActionLoadingId(rejectingSample.id);
            await rejectPhlebotomySample(rejectingSample.id, {
                rejectionReason,
                rejectionNotes: notes,
            });
            await loadWorklist();
            setRejectingSample(null);
            setRejectionNotes('');
        } catch (error) {
            console.error(`Failed to reject sample ${rejectingSample.sampleId}:`, error);
            setRejectionError('Failed to reject sample. Please try again.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const isSubmittingRejection = rejectingSample !== null && actionLoadingId === rejectingSample.id;

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                crumbs={[{ label: 'Phlebotomy', href: '/phlebotomy/worklist' }, { label: 'Worklist' }]}
                title="Sample collection"
                meta={
                    <>
                        <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Pending laboratory collection orders and patient queues</span>
                        {!isLoading && !loadError && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {worklist.length} {worklist.length === 1 ? 'sample' : 'samples'}
                                </span>
                            </>
                        )}
                    </>
                }
                actions={
                    <Button icon={RefreshCw} onClick={() => void loadWorklist()} loading={isLoading}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {isLoading
                    ? 'Loading worklist'
                    : loadError
                      ? 'Worklist failed to load'
                      : `Worklist loaded. Showing ${paginated.length} of ${filtered.length} samples${
                            totalPages > 1 ? `, page ${page} of ${totalPages}` : ''
                        }.`}
            </p>

            {/* Stat cards */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Pending collections" value={stats.pendingCollections} icon={ClipboardList} color="blue" loading={isLoading} />
                <StatCard
                    label="STAT priority"
                    value={stats.statPriority}
                    icon={Siren}
                    color="red"
                    sub={stats.statPriority > 0 ? 'Action needed' : undefined}
                    loading={isLoading}
                />
                <StatCard
                    label="Urgent priority"
                    value={stats.urgentPriority}
                    icon={AlertTriangle}
                    color="orange"
                    sub={stats.urgentPriority > 0 ? 'Action needed' : undefined}
                    loading={isLoading}
                />
                <StatCard label="Normal priority" value={stats.normalPriority} icon={Clock} color="blue" loading={isLoading} />
            </div>

            {/* Worklist */}
            <SectionCard title="Pending samples" count={isLoading || loadError ? undefined : filtered.length} flush>
                {/* Filter toolbar */}
                <div className="border-b border-edge bg-surface-muted px-3 py-2">
                    <WorklistFilters onSearch={handleSearch} onPriorityChange={handlePriorityChange} selectedPriority={priorityFilter} />
                </div>

                {/* States live outside the table so they centre on small screens */}
                {isLoading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-3">
                                <span className="flex w-48 shrink-0 flex-col gap-1.5">
                                    <span className="h-3.5 w-32 rounded bg-skeleton" />
                                    <span className="h-3 w-24 rounded bg-skeleton" />
                                </span>
                                <span className="h-4 w-14 shrink-0 rounded bg-skeleton" />
                                <span className="h-3 w-40 rounded bg-skeleton" />
                                <span className="hidden h-4 w-12 rounded-full bg-skeleton md:block" />
                                <span className="hidden h-3 w-12 rounded bg-skeleton md:block" />
                                <span className="ml-auto h-7 w-36 shrink-0 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                ) : loadError ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Worklist unavailable"
                        description={loadError}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => void loadWorklist()}>
                                Retry
                            </Button>
                        }
                    />
                ) : filtered.length === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={Search}
                            title="No samples match"
                            description="Try a different search term or priority."
                            action={
                                priorityFilter !== 'ALL' ? (
                                    <Button size="sm" onClick={() => handlePriorityChange('ALL')}>
                                        Show all priorities
                                    </Button>
                                ) : undefined
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={ClipboardList}
                            title="No pending collections"
                            description="Samples waiting for collection will appear here."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        {/* table-fixed budget: fixed cols = 96 (Priority) + 112 (Tubes) + 96 (Wait) + 192 (Actions) = 496px,
                            plus Patient at 26%. The auto "Tests requested" column gets W - 0.26W - 496, so W must be
                            >= 887 for it to clear the 160px text-column floor. min-w-[900px] leaves it 170px. */}
                        <table className="w-full min-w-[900px] table-fixed text-left text-[13px]">
                            <caption className="sr-only">Samples pending collection</caption>
                            <thead>
                                <tr className="whitespace-nowrap border-b border-edge text-xs font-medium text-fg-muted">
                                    <th scope="col" className="w-[26%] py-2 pl-4 pr-3 font-medium">
                                        Patient
                                    </th>
                                    <th scope="col" className="w-24 px-3 py-2 font-medium">
                                        Priority
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-medium">
                                        Tests requested
                                    </th>
                                    <th scope="col" className="w-28 px-3 py-2 font-medium">
                                        Tubes
                                    </th>
                                    <th scope="col" className="w-24 px-3 py-2 font-medium">
                                        Wait time
                                    </th>
                                    <th scope="col" className="w-48 py-2 pl-2 pr-3 text-right font-medium">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge whitespace-nowrap">
                                {paginated.map((sample) => {
                                    const recollection = isRecollectionSample(sample);
                                    const busy = actionLoadingId === sample.id;
                                    return (
                                        <tr
                                            key={sample.id}
                                            className={cn(
                                                'transition-colors',
                                                recollection ? 'bg-status-pending-bg' : 'hover:bg-surface-hover'
                                            )}
                                        >
                                            {/* Patient */}
                                            <td className="py-2 pl-4 pr-3">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <p className="min-w-0 truncate font-medium text-fg">{sample.patient.name}</p>
                                                    {recollection && (
                                                        <StatusChip tone="pending" size="sm" className="shrink-0">
                                                            Recollection
                                                        </StatusChip>
                                                    )}
                                                </div>
                                                <p className="truncate text-xs text-fg-muted">
                                                    {sample.patient.pid} · {sample.patient.age}Y {sample.patient.gender}
                                                </p>
                                                {sample.patient.wardRoom && (
                                                    <p className="mt-0.5 truncate text-xs text-primary-strong">{sample.patient.wardRoom}</p>
                                                )}
                                            </td>
                                            {/* Priority */}
                                            <td className="px-3 py-2">
                                                <PriorityBadge priority={sample.priority} />
                                            </td>
                                            {/* Tests */}
                                            <td className="px-3 py-2">
                                                <p className="truncate font-medium text-fg-secondary" title={sample.testType}>
                                                    {sample.testType}
                                                </p>
                                                {sample.testCodes.length > 0 && (
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {sample.testCodes.map((c) => (
                                                            <StatusChip key={c} tone="neutral" size="sm" title={c}>
                                                                {c}
                                                            </StatusChip>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            {/* Tubes — cap colours are physical so they stay literal */}
                                            <td className="px-3 py-2">
                                                {sample.tubeTypes.length > 0 ? (
                                                    <ul
                                                        className="flex gap-1"
                                                        aria-label={`Tubes: ${sample.tubeTypes.map((t) => formatStatusLabel(t)).join(', ')}`}
                                                    >
                                                        {sample.tubeTypes.map((t) => (
                                                            <li
                                                                key={t}
                                                                className={cn('h-4 w-4 rounded-full ring-2 ring-surface', TUBE_COLOR_MAP[t] ?? 'bg-fg-faint')}
                                                                title={formatStatusLabel(t)}
                                                            />
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span className="text-fg-faint">—</span>
                                                )}
                                            </td>
                                            {/* Wait time */}
                                            <td className="px-3 py-2">
                                                <span className={cn('font-semibold tabular-nums', waitTimeTone(sample.waitTimeMinutes))}>
                                                    {formatWaitTime(sample.waitTimeMinutes)}
                                                </span>
                                            </td>
                                            {/* Actions */}
                                            <td className="py-2 pl-2 pr-3 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        icon={recollection ? RotateCcw : Play}
                                                        loading={busy}
                                                        onClick={() => handleCollect(sample.id, sample.sampleId)}
                                                        aria-label={`${recollection ? 'Recollect' : 'Collect'} sample ${sample.sampleId} for ${sample.patient.name}`}
                                                    >
                                                        {recollection ? 'Recollect' : 'Collect'}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={Ban}
                                                        disabled={busy}
                                                        onClick={() => openRejectForm(sample)}
                                                        aria-label={`Reject sample ${sample.sampleId} for ${sample.patient.name}`}
                                                        className="text-status-danger-fg hover:bg-status-danger-bg hover:text-status-danger-fg"
                                                    >
                                                        Reject
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer: paging */}
                {!isLoading && !loadError && filtered.length > 0 && (
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={filtered.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={setCurrentPage}
                        itemLabel="samples"
                    />
                )}
            </SectionCard>

            {/* Reject dialog */}
            <Modal
                open={rejectingSample !== null}
                onClose={closeRejectForm}
                title="Reject sample"
                description={
                    rejectingSample ? `${rejectingSample.sampleId} · ${rejectingSample.patient.name} · ${rejectingSample.testType}` : undefined
                }
                size="md"
                dismissible={!isSubmittingRejection}
                footer={
                    <>
                        <Button variant="secondary" disabled={isSubmittingRejection} onClick={closeRejectForm}>
                            Cancel
                        </Button>
                        <Button variant="danger" icon={Ban} loading={isSubmittingRejection} onClick={handleReject}>
                            {isSubmittingRejection ? 'Submitting…' : 'Submit rejection'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <SelectField
                        label="Reason"
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value as RejectionReason)}
                    >
                        {REJECTION_REASON_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </SelectField>
                    <TextareaField
                        label="Message"
                        required
                        hint="Shown in the collection history for this sample."
                        error={rejectionError || undefined}
                        value={rejectionNotes}
                        onChange={(event) => {
                            setRejectionNotes(event.target.value);
                            if (rejectionError) setRejectionError('');
                        }}
                        rows={3}
                        maxLength={500}
                        placeholder="Type the rejection message"
                    />
                </div>
            </Modal>
        </div>
    );
}
