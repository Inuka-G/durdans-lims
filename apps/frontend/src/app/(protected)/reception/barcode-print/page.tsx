'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AxiosError } from 'axios';
import {
    BadgeCheck,
    ChevronLeft,
    CircleCheck,
    Clock,
    Download,
    FlaskConical,
    Hash,
    Printer,
    ScanBarcode,
    Search,
    TestTubes,
    TriangleAlert,
    User,
    type LucideIcon,
} from 'lucide-react';
import {
    getPatientById,
    printSampleLabel,
    searchSamplesForPrint,
    type Patient,
    type SamplePrintItem,
} from '@/lib/api';
import { getTubeHexColor } from '@/lib/phlebotomy-label-print';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import EmptyState from '@/components/ui/EmptyState';
import { InputField } from '@/components/ui/Field';
import StatusChip, { STATUS_TONE, humanizeStatus, type ChipTone } from '@/components/ui/StatusChip';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { formatRegistered } from '@/components/patient-dashboard/dashboard-data';

/* ------------------------------------------------------------------ */
/*  Constants / helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * Reception-specific sample statuses that are not (yet) in the shared
 * STATUS_TONE map. Tones only — colours still come from StatusChip.
 */
const LOCAL_STATUS_TONE: Record<string, ChipTone> = {
    PENDING_COLLECTION: 'pending',
    RECOLLECTION_REQUIRED: 'danger',
    RECEIVED_AT_LAB: 'neutral',
    QUALITY_CHECK: 'pending',
    ACCEPTED: 'success',
    IN_TESTING: 'pending',
    RESULT_ENTERED: 'info',
    SENT_FOR_VERIFICATION: 'info',
};

function toneForSampleStatus(status?: string | null): ChipTone {
    if (!status) return 'neutral';
    const key = status.toUpperCase();
    return STATUS_TONE[key] ?? LOCAL_STATUS_TONE[key] ?? 'neutral';
}

function formatCollected(value: string | null, by: string | null): string {
    if (!value) return 'Collection details unavailable';
    const date = new Date(value);
    let when: string;
    if (Number.isNaN(date.getTime())) {
        when = value;
    } else {
        // formatRegistered only includes the clock time for Today/Yesterday;
        // collection time is lab-relevant, so append it for older dates too.
        const label = formatRegistered(date);
        const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
        when = /^(Today|Yesterday)/.test(label) ? label : `${label} ${time}`;
    }
    return by ? `${when} by ${by}` : when;
}

/** "Back to quality verification" / "Back to sample" depending on where the user came from. */
function backLabel(returnTo: string): string {
    if (returnTo.startsWith('/reception/quality-verification')) return 'Back to quality verification';
    if (returnTo.startsWith('/reception/samples/')) return 'Back to sample';
    return 'Back';
}

const SKELETON_ROWS = 3;

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function BarcodePrintPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('query') ?? '';
    const returnTo = searchParams.get('returnTo');
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<SamplePrintItem[]>([]);
    const [selectedResult, setSelectedResult] = useState<SamplePrintItem | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [loading, setLoading] = useState(false);
    const [patientLoading, setPatientLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [printQueue, setPrintQueue] = useState<string[]>([]);
    const [recordingPrint, setRecordingPrint] = useState(false);
    const [readyToReturn, setReadyToReturn] = useState(false);

    useEffect(() => {
        if (initialQuery) {
            setSearchQuery(initialQuery);
        }
    }, [initialQuery]);

    const patientDisplayName = useMemo(() => {
        if (!selectedResult) {
            return null;
        }

        if (selectedPatient?.fullName) {
            return selectedPatient.fullName;
        }

        return selectedResult.patient?.pid ?? 'Unknown patient';
    }, [selectedPatient, selectedResult]);

    /**
     * Specimen tube cap colour, read from the stocked tube in supplies and carried on the
     * sample payload. It mirrors a physical object, so it stays a literal colour in both
     * themes; `getTubeHexColor` validates the shape and falls back to the neutral grey that
     * flags "no stocked container to read a colour from".
     */
    const tubeColor = getTubeHexColor(selectedResult?.tubeColor);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setError('Enter a barcode, patient ID, order number or test name to search.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        setSelectedPatient(null);
        setReadyToReturn(false);

        try {
            const data = await searchSamplesForPrint(searchQuery.trim());
            setResults(data);

            if (data.length === 0) {
                setSelectedResult(null);
                setError('No matching samples were found for barcode print.');
                return;
            }

            setSelectedResult(data[0]);
            await loadPatient(data[0]);
        } catch (err) {
            console.error('Failed to search samples for barcode print', err);
            setResults([]);
            setSelectedResult(null);
            setError(getApiErrorMessage(err, 'Failed to search for the sample. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    const loadPatient = async (sample: SamplePrintItem) => {
        if (!sample.patient?.pid) {
            setSelectedPatient(null);
            return;
        }

        setPatientLoading(true);

        try {
            const patient = await getPatientById(sample.patient.pid);
            setSelectedPatient(patient);
        } catch (err) {
            console.error('Failed to load patient details for barcode print', err);
            setSelectedPatient(null);
        } finally {
            setPatientLoading(false);
        }
    };

    const handleSelectResult = async (sample: SamplePrintItem) => {
        setSelectedResult(sample);
        setSelectedPatient(null);
        setError(null);
        setSuccessMessage(null);
        setReadyToReturn(false);
        await loadPatient(sample);
    };

    const handlePrint = async () => {
        if (!selectedResult) {
            return;
        }

        if (!selectedResult.id) {
            setError('Unable to record this print — sample reference is incomplete. Refresh and try again.');
            return;
        }

        setRecordingPrint(true);
        setError(null);
        setSuccessMessage(null);
        setReadyToReturn(false);

        try {
            await printSampleLabel(selectedResult.id);
            const barcodeText = selectedResult.sampleId;

            setPrintQueue((current) => [barcodeText, ...current.filter((id) => id !== barcodeText)]);

            const opened = openPrintWindow({
                sampleId: barcodeText,
                orderId: selectedResult.orderId ?? 'No order',
                patientName: patientDisplayName ?? 'Unknown patient',
                patientCode: selectedResult.patient?.pid ?? 'No PID',
                testType: selectedResult.testType ?? 'Unknown test',
                testCodes: selectedResult.testCodes ?? [],
                tubeTypes: selectedResult.tubeTypes ?? [],
                tubeColor,
            });

            if (!opened) {
                setError(
                    'The label print was recorded for audit, but the print window was blocked. Allow popups and print again if needed.'
                );
                return;
            }

            if (returnTo) {
                setReadyToReturn(true);
                setSuccessMessage(`Print recorded for ${barcodeText}. After saving or printing the label, return to verification.`);
                return;
            }

            setSuccessMessage(`Print recorded and dialog opened for ${barcodeText}.`);
        } catch (err) {
            console.error('Failed to record specimen label print from reception', err);
            setError(getApiErrorMessage(err, 'Could not save the label print for audit. Please try again.'));
        } finally {
            setRecordingPrint(false);
        }
    };

    useEffect(() => {
        if (!initialQuery) {
            return;
        }

        let cancelled = false;

        const preloadSearch = async () => {
            setLoading(true);
            setError(null);
            setSuccessMessage(null);
            setSelectedPatient(null);

            try {
                const data = await searchSamplesForPrint(initialQuery.trim());
                if (cancelled) {
                    return;
                }

                setResults(data);

                if (data.length === 0) {
                    setSelectedResult(null);
                    setError('No matching samples were found for barcode print.');
                    return;
                }

                setSelectedResult(data[0]);
                await loadPatient(data[0]);
            } catch (err) {
                if (cancelled) {
                    return;
                }

                console.error('Failed to preload barcode print search', err);
                setResults([]);
                setSelectedResult(null);
                setError(getApiErrorMessage(err, 'Failed to search for the sample. Please try again.'));
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void preloadSearch();

        return () => {
            cancelled = true;
        };
    }, [initialQuery]);

    const detailRows: { label: string; value: string; icon: LucideIcon }[] = selectedResult
        ? [
              { label: 'Sample ID', value: selectedResult.sampleId, icon: FlaskConical },
              {
                  label: 'Patient',
                  value: patientLoading
                      ? 'Loading patient…'
                      : `${patientDisplayName ?? 'Unknown patient'} (${selectedResult.patient?.pid ?? 'No PID'})`,
                  icon: User,
              },
              { label: 'Test type', value: selectedResult.testType ?? 'Unknown test', icon: TestTubes },
              { label: 'Order no', value: selectedResult.orderId ?? 'Unavailable', icon: Hash },
              {
                  label: 'Collected',
                  value: formatCollected(selectedResult.collectedAt, selectedResult.collectedBy),
                  icon: Clock,
              },
              { label: 'Status', value: humanizeStatus(selectedResult.status), icon: BadgeCheck },
          ]
        : [];

    return (
        <div className="mx-auto max-w-[1400px]">
            <PageHeader
                title="Barcode print"
                crumbs={[{ label: 'Lab reception', href: '/reception/accessioning' }, { label: 'Barcode print' }]}
                meta={
                    <>
                        <ScanBarcode className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Search samples and print accession barcode labels</span>
                    </>
                }
                actions={
                    returnTo ? (
                        <Button href={returnTo} icon={ChevronLeft}>
                            {backLabel(returnTo)}
                        </Button>
                    ) : undefined
                }
            />

            {/* Screen-reader status for async changes */}
            <p role="status" aria-live="polite" className="sr-only">
                {loading
                    ? 'Searching samples'
                    : recordingPrint
                      ? 'Recording label print'
                      : selectedResult
                        ? `${results.length} matching ${results.length === 1 ? 'sample' : 'samples'}. Selected ${selectedResult.sampleId}.`
                        : ''}
            </p>

            <div aria-live="assertive" role="alert">
                {error && (
                    <div className="mb-4 flex items-start gap-3 rounded-lg border border-status-danger-edge bg-status-danger-bg p-3 text-sm text-status-danger-fg">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p className="min-w-0 break-words">{error}</p>
                    </div>
                )}
            </div>

            {successMessage && (
                <div
                    role="status"
                    className="mb-4 flex flex-col gap-3 rounded-lg border border-status-verified-edge bg-status-verified-bg p-3 text-sm text-status-verified-fg sm:flex-row sm:items-center sm:justify-between"
                >
                    <span className="inline-flex min-w-0 items-start gap-2">
                        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="break-words">{successMessage}</span>
                    </span>
                    {returnTo && readyToReturn && (
                        <Button
                            size="sm"
                            icon={CircleCheck}
                            className="shrink-0"
                            onClick={() => router.push(withReturnFlag(returnTo, 'barcodePrinted', 'true'))}
                        >
                            Return to verification
                        </Button>
                    )}
                </div>
            )}

            {/* Search */}
            <form
                role="search"
                className="mb-4 rounded-lg border border-edge bg-surface p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    void handleSearch();
                }}
            >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <InputField
                        label="Search samples"
                        hideLabel
                        type="search"
                        name="barcode-search"
                        autoComplete="off"
                        placeholder="Scan or type sample ID, patient ID, order ID or test"
                        hint="Try DH-20260506-00100006, PAT2026-00001 or ORD-20260506-010002"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="min-w-0 flex-1"
                    />
                    <Button type="submit" icon={Search} loading={loading}>
                        {loading ? 'Searching…' : 'Search'}
                    </Button>
                </div>
            </form>

            {selectedResult ? (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                    {/* Matching samples */}
                    <SectionCard title="Matching samples" count={results.length} flush className="min-w-0">
                        <ul className="divide-y divide-edge">
                            {results.map((sample) => {
                                const isActive = sample.id === selectedResult.id;

                                return (
                                    <li key={sample.id}>
                                        <button
                                            type="button"
                                            aria-pressed={isActive}
                                            onClick={() => void handleSelectResult(sample)}
                                            className={cn(
                                                'block w-full px-4 py-3 text-left transition-colors',
                                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                                                isActive ? 'bg-primary-soft' : 'hover:bg-surface-hover'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-mono text-sm font-semibold text-primary-strong">
                                                        {sample.sampleId}
                                                    </p>
                                                    <p className="mt-0.5 truncate text-[13px] text-fg-secondary">
                                                        {sample.patient?.pid ?? 'Unknown patient'}
                                                    </p>
                                                    <p className="truncate text-xs text-fg-muted">
                                                        {sample.orderId ?? 'Order unavailable'}
                                                    </p>
                                                </div>
                                                <PriorityBadge priority={sample.priority} />
                                            </div>
                                            <div className="mt-2 flex min-w-0 items-center gap-2">
                                                <StatusChip tone={toneForSampleStatus(sample.status)} size="sm" dot>
                                                    {humanizeStatus(sample.status)}
                                                </StatusChip>
                                                <span className="min-w-0 truncate text-xs text-fg-muted">
                                                    {sample.testType ?? 'Unknown test'}
                                                </span>
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </SectionCard>

                    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                        {/* Sample details */}
                        <SectionCard title="Sample details" className="min-w-0">
                            <dl className="space-y-3">
                                {detailRows.map((row) => {
                                    const Icon = row.icon;
                                    return (
                                        <div key={row.label} className="flex items-start gap-3">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted">
                                                <Icon className="h-4 w-4 text-fg-muted" aria-hidden="true" />
                                            </div>
                                            <div className="min-w-0">
                                                <dt className="text-xs text-fg-muted">{row.label}</dt>
                                                <dd
                                                    className={cn(
                                                        'break-words text-sm font-medium text-fg',
                                                        row.label === 'Patient' && patientLoading && 'text-fg-muted'
                                                    )}
                                                    aria-busy={row.label === 'Patient' && patientLoading ? true : undefined}
                                                >
                                                    {row.value}
                                                </dd>
                                            </div>
                                        </div>
                                    );
                                })}
                            </dl>
                        </SectionCard>

                        {/* Label preview */}
                        <SectionCard title="Label preview" className="min-w-0">
                            {/* The preview mimics the physical white label, so it stays black-on-white in both themes. */}
                            <div className="mb-4 rounded-md border border-dashed border-edge-strong bg-white p-4 text-black">
                                <span className="sr-only">Label preview: </span>
                                <div className="flex items-start gap-3">
                                    {/* Tube cap colour comes from the stocked supply row — a physical colour, not a theme token. */}
                                    <span
                                        className="h-16 w-3 shrink-0 rounded-full"
                                        style={{ backgroundColor: tubeColor }}
                                        aria-hidden="true"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1.5 flex items-center justify-between gap-2">
                                            <p className="truncate font-mono text-sm font-bold">{selectedResult.sampleId}</p>
                                            <p className="shrink-0 text-xs text-black/60">{selectedResult.orderId ?? 'No order'}</p>
                                        </div>
                                        <p className="mb-0.5 truncate text-xs text-black/80">
                                            {patientDisplayName ?? 'Unknown patient'} · {selectedResult.patient?.pid ?? 'No PID'}
                                        </p>
                                        <p className="mb-2 truncate text-xs text-black/70">{selectedResult.testType ?? 'Unknown test'}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {(selectedResult.testCodes ?? []).map((code) => (
                                                <span
                                                    key={code}
                                                    className="rounded border border-black/20 bg-white px-1.5 py-0.5 text-[9px] font-medium leading-none text-black"
                                                >
                                                    {code}
                                                </span>
                                            ))}
                                            {(selectedResult.tubeTypes ?? []).length > 0 && (
                                                <span className="rounded border border-black/20 bg-white px-1.5 py-0.5 text-[9px] font-medium leading-none text-black">
                                                    {(selectedResult.tubeTypes ?? []).join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-center gap-px overflow-hidden" aria-hidden="true">
                                    {buildBarcodePattern(selectedResult.sampleId).map((width, index) => (
                                        <span
                                            key={`${selectedResult.sampleId}-${index}`}
                                            className="block shrink-0 bg-black"
                                            style={{ width, height: 32 }}
                                        />
                                    ))}
                                </div>
                                <p className="mt-1 text-center font-mono text-[10px] text-black/70">{selectedResult.sampleId}</p>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="primary"
                                    icon={Printer}
                                    loading={recordingPrint}
                                    onClick={() => void handlePrint()}
                                    className="flex-1"
                                >
                                    {recordingPrint ? 'Saving…' : 'Print label'}
                                </Button>
                                <Button
                                    icon={Download}
                                    disabled={recordingPrint}
                                    onClick={() => void handlePrint()}
                                    aria-label="Save label as PDF (opens the print dialog)"
                                    title="Save label as PDF"
                                />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            ) : loading ? (
                <SectionCard title="Matching samples" flush>
                    <ul aria-hidden="true" className="divide-y divide-edge">
                        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                            <li key={i} className="px-4 py-3">
                                <span className="block h-3.5 w-44 max-w-full rounded bg-skeleton" />
                                <span className="mt-2 block h-3 w-28 rounded bg-skeleton" />
                                <span className="mt-2 block h-3 w-36 rounded bg-skeleton" />
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            ) : (
                <div className="rounded-lg border border-edge bg-surface">
                    <EmptyState
                        icon={ScanBarcode}
                        title="No sample selected"
                        description="Search by sample ID, patient ID, order number or test name to preview and print its barcode label."
                    />
                </div>
            )}

            {printQueue.length > 0 && (
                <SectionCard title="Print queue" count={printQueue.length} className="mt-4">
                    <ul className="flex flex-wrap gap-2" aria-label="Labels sent to print this session">
                        {printQueue.map((id) => (
                            <li key={id}>
                                <StatusChip tone="success" dot className="font-mono">
                                    {id}
                                </StatusChip>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            )}
        </div>
    );
}

export default function BarcodePrintPage() {
    // useSearchParams needs a Suspense boundary for static prerendering.
    return (
        <Suspense fallback={null}>
            <BarcodePrintPageInner />
        </Suspense>
    );
}

/* ------------------------------------------------------------------ */
/*  Print helpers (the printable document is deliberately black-on-white) */
/* ------------------------------------------------------------------ */

function buildBarcodePattern(sampleId: string) {
    return Array.from(sampleId).flatMap((char, index) => {
        const base = char.charCodeAt(0) + index;
        return [base % 3 === 0 ? 3 : 1, base % 2 === 0 ? 2 : 1];
    });
}

function withReturnFlag(returnTo: string, key: string, value: string) {
    const [path, hash = ''] = returnTo.split('#');
    const [pathname, query = ''] = path.split('?');
    const params = new URLSearchParams(query);
    params.set(key, value);

    const nextUrl = `${pathname}?${params.toString()}`;
    return hash ? `${nextUrl}#${hash}` : nextUrl;
}

type PrintWindowPayload = {
    sampleId: string;
    orderId: string;
    patientName: string;
    patientCode: string;
    testType: string;
    testCodes: string[];
    tubeTypes: string[];
    /** Hex tube cap colour, already shape-checked by `getTubeHexColor`. */
    tubeColor: string;
};

function openPrintWindow(payload: PrintWindowPayload) {
    const printWindow = window.open('', '_blank', 'width=480,height=640');
    if (!printWindow) {
        return false;
    }

    const barcodeBars = buildBarcodePattern(payload.sampleId)
        .map((width) => `<div style="width:${width}px;height:42px;background:#0f172a;border-radius:1px;"></div>`)
        .join('');
    const testBadges = [...payload.testCodes, ...payload.tubeTypes]
        .map((item) => `<span style="font-size:10px;padding:2px 6px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#475569;">${escapeHtml(item)}</span>`)
        .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Print Label - ${escapeHtml(payload.sampleId)}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 24px;
      background: #f8fafc;
      color: #0f172a;
    }
    .label {
      width: 360px;
      margin: 0 auto;
      background: #fff;
      border: 1px dashed #cbd5e1;
      border-radius: 16px;
      padding: 20px;
      box-sizing: border-box;
    }
    .row {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .tube {
      width: 14px;
      height: 78px;
      border-radius: 999px;
      background: ${escapeHtml(payload.tubeColor)};
      flex-shrink: 0;
    }
    .top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 8px;
    }
    .title {
      font-size: 28px;
      font-weight: 700;
      line-height: 1.1;
      margin: 0 0 6px;
    }
    .meta {
      font-size: 15px;
      color: #475569;
      margin: 0 0 6px;
    }
    .sub {
      font-size: 14px;
      color: #64748b;
      margin: 0 0 12px;
    }
    .badges {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .barcode {
      display: flex;
      justify-content: center;
      gap: 1px;
      margin: 20px 0 8px;
    }
    .barcode-label {
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .label {
        border: none;
        border-radius: 0;
        width: auto;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="row">
      <div class="tube"></div>
      <div style="flex:1;">
        <div class="top">
          <div class="title">${escapeHtml(payload.sampleId)}</div>
          <div style="font-size:13px;color:#64748b;">${escapeHtml(payload.orderId)}</div>
        </div>
        <p class="meta">${escapeHtml(payload.patientName)} • ${escapeHtml(payload.patientCode)}</p>
        <p class="sub">${escapeHtml(payload.testType)}</p>
        <div class="badges">${testBadges}</div>
      </div>
    </div>
    <div class="barcode">${barcodeBars}</div>
    <div class="barcode-label">${escapeHtml(payload.sampleId)}</div>
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return true;
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
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
