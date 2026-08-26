'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { AlertTriangle, Eye, History, Layers, RefreshCw, SearchX, X } from 'lucide-react';
import { getMltAllWorklist, type MltAllWorklistItem } from '@/lib/api';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { InputField, SelectField } from '@/components/ui/Field';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import StatusChip, { humanizeStatus, toneForStatus, type ChipTone } from '@/components/ui/StatusChip';
import PriorityBadge from '@/components/shared/PriorityBadge';

const PAGE_SIZE = 8;
const SKELETON_ROWS = 6;

/** Option values stay unchanged so the filter logic keeps matching; only the label is sentence case. */
const OPTION_LABELS: Record<string, string> = {
    'All Departments': 'All departments',
    'All Test Types': 'All test types',
};

/** Lab-side sample statuses that STATUS_TONE does not cover yet are mapped to a chip tone here. */
const MLT_STATUS_TONE: Record<string, ChipTone> = {
    PENDING_COLLECTION: 'neutral',
    RECOLLECTION_REQUIRED: 'pending',
    RECEIVED_AT_LAB: 'neutral',
    QUALITY_CHECK: 'pending',
    ACCEPTED: 'success',
    IN_TESTING: 'pending',
    RESULT_ENTERED: 'info',
    SENT_FOR_VERIFICATION: 'info',
};

function sampleStatusTone(status: string): ChipTone {
    const key = (status || '').toUpperCase();
    return MLT_STATUS_TONE[key] ?? toneForStatus(key);
}

export default function MLTAllWorklistPage() {
    const router = useRouter();
    const [samples, setSamples] = useState<MltAllWorklistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [department, setDepartment] = useState('All Departments');
    const [testType, setTestType] = useState('All Test Types');
    const [currentPage, setCurrentPage] = useState(1);

    const loadSamples = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            setSamples(await getMltAllWorklist());
        } catch (err) {
            console.error('Failed to load all MLT worklist items', err);
            setError(getApiErrorMessage(err, "Couldn't load the all-worklist view. Check your connection and retry."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadSamples();
    }, [loadSamples]);

    const departments = useMemo(() => {
        const uniqueDepartments = Array.from(
            new Set(samples.map((sample) => sample.department).filter(Boolean))
        ).sort();
        return ['All Departments', ...uniqueDepartments];
    }, [samples]);

    const testTypes = useMemo(() => {
        const uniqueTestTypes = Array.from(
            new Set(samples.map((sample) => sample.testName).filter(Boolean))
        ).sort();
        return ['All Test Types', ...uniqueTestTypes];
    }, [samples]);

    const filtered = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return samples.filter((sample) => {
            const matchesSearch =
                !query ||
                sample.patientName.toLowerCase().includes(query) ||
                sample.patientId.toLowerCase().includes(query) ||
                sample.barcode.toLowerCase().includes(query) ||
                sample.orderId.toLowerCase().includes(query);
            const matchesDept = department === 'All Departments' || sample.department === department;
            const matchesTest = testType === 'All Test Types' || sample.testName === testType;

            return matchesSearch && matchesDept && matchesTest;
        });
    }, [samples, searchQuery, department, testType]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const hasFilters =
        searchQuery.trim().length > 0 || department !== 'All Departments' || testType !== 'All Test Types';

    const clearFilters = () => {
        setSearchQuery('');
        setDepartment('All Departments');
        setTestType('All Test Types');
        setCurrentPage(1);
    };

    // "Showing 12 samples in Haematology — Lipid profile" for the live region and card meta.
    // The dash stays attached to the test part so "12 samples — Lipid profile" keeps its
    // connector when no department is selected.
    const scopeLabel = [
        department !== 'All Departments' ? `in ${department}` : null,
        testType !== 'All Test Types' ? `— ${testType}` : null,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="All worklist"
                crumbs={[{ label: 'Laboratory' }, { label: 'Worklist' }]}
                meta={
                    <>
                        <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Cross-department view</span>
                        <span aria-hidden="true">·</span>
                        <span>Read-only</span>
                        {!loading && !error && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                    {filtered.length} {filtered.length === 1 ? 'sample' : 'samples'}
                                    {scopeLabel ? ` ${scopeLabel}` : ''}
                                </span>
                            </>
                        )}
                    </>
                }
                actions={
                    <Button icon={RefreshCw} onClick={() => void loadSamples()} loading={loading}>
                        Refresh
                    </Button>
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Loading all-worklist samples'
                    : error
                      ? 'All-worklist view failed to load'
                      : `All-worklist loaded. Showing ${paginated.length} of ${filtered.length} samples${
                            scopeLabel ? ` ${scopeLabel}` : ''
                        }${totalPages > 1 ? `, page ${currentPage} of ${totalPages}` : ''}.`}
            </p>

            <SectionCard title="Samples" count={loading || error ? undefined : filtered.length} flush>
                {/* Filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-surface-muted px-3 py-2">
                    <InputField
                        label="Search all worklist"
                        hideLabel
                        type="search"
                        value={searchQuery}
                        onChange={(event) => {
                            setSearchQuery(event.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="Search sample ID, patient, patient ID or order"
                        autoComplete="off"
                        className="min-w-[200px] flex-1"
                    />
                    <SelectField
                        label="Department"
                        hideLabel
                        value={department}
                        onChange={(event) => {
                            setDepartment(event.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full sm:w-44"
                    >
                        {departments.map((item) => (
                            <option key={item} value={item}>
                                {OPTION_LABELS[item] ?? item}
                            </option>
                        ))}
                    </SelectField>
                    <SelectField
                        label="Test type"
                        hideLabel
                        value={testType}
                        onChange={(event) => {
                            setTestType(event.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full sm:w-56"
                    >
                        {testTypes.map((item) => (
                            <option key={item} value={item}>
                                {OPTION_LABELS[item] ?? item}
                            </option>
                        ))}
                    </SelectField>
                    {hasFilters && (
                        <Button variant="ghost" icon={X} onClick={clearFilters}>
                            Clear filters
                        </Button>
                    )}
                </div>

                {/* Refresh failed but the last successful load is still on screen: keep the rows,
                    surface the failure as a compact strip instead of replacing the table. */}
                {!loading && error && samples.length > 0 && (
                    <div className="flex items-center gap-2 bg-status-danger-bg px-4 py-2 text-xs text-status-danger-fg ring-1 ring-inset ring-status-danger-edge">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate" title={error}>
                            {error}
                        </span>
                        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => void loadSamples()}>
                            Retry
                        </Button>
                    </div>
                )}

                {/* States live outside the table so they centre on small screens */}
                {loading ? (
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="flex items-center gap-3 px-4 py-3">
                                <span className="h-3.5 w-28 shrink-0 rounded bg-skeleton" />
                                <span className="flex w-44 shrink-0 flex-col gap-1.5">
                                    <span className="h-3.5 w-32 rounded bg-skeleton" />
                                    <span className="h-3 w-20 rounded bg-skeleton" />
                                </span>
                                <span className="hidden w-40 flex-col gap-1.5 md:flex">
                                    <span className="h-3.5 w-36 rounded bg-skeleton" />
                                    <span className="h-3 w-24 rounded bg-skeleton" />
                                </span>
                                <span className="h-4 w-14 rounded bg-skeleton" />
                                <span className="h-4 w-20 rounded bg-skeleton" />
                                <span className="ml-auto flex gap-2">
                                    <span className="h-7 w-16 rounded bg-skeleton" />
                                    <span className="h-7 w-20 rounded bg-skeleton" />
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : error && samples.length === 0 ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="All-worklist unavailable"
                        description={error}
                        action={
                            <Button size="sm" icon={RefreshCw} onClick={() => void loadSamples()}>
                                Retry
                            </Button>
                        }
                    />
                ) : filtered.length === 0 ? (
                    samples.length === 0 ? (
                        <EmptyState
                            icon={Layers}
                            title="No samples yet"
                            description="Samples from every department will be listed here as they move through the lab."
                        />
                    ) : (
                        <EmptyState
                            icon={SearchX}
                            title="No samples match"
                            description="Try a different search term, department or test type."
                            action={
                                <Button size="sm" icon={X} onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    )
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            {/* table-fixed budget: 144 (Sample ID) + 192 (Patient) + 96 (Priority)
                                + 192 (Status) + 192 (Actions) = 816px of fixed columns. The auto
                                "Test type" column takes whatever is left, so min-w must stay at
                                816 + 160 (text-column floor) = 976 or the column collapses. */}
                            <table className="w-full min-w-[980px] table-fixed text-left text-sm">
                                <caption className="sr-only">Samples across all departments</caption>
                                <thead>
                                    <tr className="whitespace-nowrap border-b border-edge text-xs font-semibold text-fg-muted">
                                        <th scope="col" className="w-36 py-2 pl-4 pr-3 font-semibold">
                                            Sample ID
                                        </th>
                                        <th scope="col" className="w-48 px-3 py-2 font-semibold">
                                            Patient
                                        </th>
                                        <th scope="col" className="px-3 py-2 font-semibold">
                                            Test type
                                        </th>
                                        <th scope="col" className="w-24 px-3 py-2 font-semibold">
                                            Priority
                                        </th>
                                        <th scope="col" className="w-48 px-3 py-2 font-semibold">
                                            Status
                                        </th>
                                        <th scope="col" className="w-48 py-2 pl-2 pr-3 text-right font-semibold">
                                            <span className="sr-only">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-edge whitespace-nowrap">
                                    {paginated.map((sample) => (
                                        <tr key={sample.sampleId} className="transition-colors hover:bg-surface-hover">
                                            <td className="truncate py-2 pl-4 pr-3 font-mono text-xs font-medium tabular-nums text-primary-strong" title={sample.barcode}>
                                                {sample.barcode}
                                            </td>
                                            <td className="min-w-0 px-3 py-2">
                                                <p className="truncate font-medium text-fg" title={sample.patientName}>
                                                    {sample.patientName}
                                                </p>
                                                <p className="truncate text-xs tabular-nums text-fg-muted" title={sample.patientId}>
                                                    {sample.patientId}
                                                </p>
                                            </td>
                                            <td className="min-w-0 px-3 py-2">
                                                <p className="truncate text-fg-secondary" title={sample.testName}>
                                                    {sample.testName}
                                                </p>
                                                <p className="truncate text-xs text-fg-muted" title={sample.department}>
                                                    {sample.department}
                                                </p>
                                            </td>
                                            <td className="px-3 py-2">
                                                <PriorityBadge priority={sample.priority} />
                                            </td>
                                            <td className="px-3 py-2">
                                                <StatusChip
                                                    tone={sampleStatusTone(sample.status)}
                                                    dot
                                                    title={humanizeStatus(sample.status || '—')}
                                                >
                                                    {humanizeStatus(sample.status || '—')}
                                                </StatusChip>
                                            </td>
                                            <td className="py-2 pl-2 pr-3 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        icon={Eye}
                                                        onClick={() => router.push(`/mlt/result-entry?sampleId=${sample.sampleId}`)}
                                                        aria-label={`View ${sample.barcode}`}
                                                    >
                                                        View
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        icon={History}
                                                        onClick={() => router.push(`/mlt/result-entry?sampleId=${sample.sampleId}&tab=history`)}
                                                        aria-label={`History for ${sample.barcode}`}
                                                    >
                                                        History
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filtered.length}
                            pageSize={PAGE_SIZE}
                            onPageChange={setCurrentPage}
                            itemLabel="samples"
                        />
                    </>
                )}
            </SectionCard>
        </div>
    );
}

function getApiErrorMessage(error: unknown, fallbackMessage: string) {
    if (error instanceof AxiosError) {
        const responseMessage = error.response?.data?.message;

        if (typeof responseMessage === 'string' && responseMessage.trim()) {
            return responseMessage;
        }
    }

    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return fallbackMessage;
}
