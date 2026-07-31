'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AxiosError } from 'axios';
import {
    getPatientById,
    printSampleLabel,
    searchSamplesForReprint,
    type Patient,
    type SampleReprintItem,
} from '@/lib/api';
import { PRIORITY_COLORS, SAMPLE_STATUS_COLORS, formatStatusLabel } from '@/constants/sample-lifecycle';

const TUBE_COLOR_CLASS: Record<string, string> = {
    EDTA_PURPLE: 'bg-purple-500',
    PLAIN_RED: 'bg-red-500',
    SODIUM_CITRATE_BLUE: 'bg-blue-500',
    SERUM_SEPARATOR_GOLD: 'bg-amber-400',
    FLUORIDE_OXALATE_GRAY: 'bg-slate-500',
};

export default function BarcodeReprintPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('query') ?? '';
    const returnTo = searchParams.get('returnTo');
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<SampleReprintItem[]>([]);
    const [selectedResult, setSelectedResult] = useState<SampleReprintItem | null>(null);
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

        return selectedResult.patient?.pid ?? 'Unknown Patient';
    }, [selectedPatient, selectedResult]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setError('Enter a barcode, patient ID, order number, or test name to search.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        setSelectedPatient(null);
        setReadyToReturn(false);

        try {
            const data = await searchSamplesForReprint(searchQuery.trim());
            setResults(data);

            if (data.length === 0) {
                setSelectedResult(null);
                setError('No matching samples were found for barcode reprint.');
                return;
            }

            setSelectedResult(data[0]);
            await loadPatient(data[0]);
        } catch (err) {
            console.error('Failed to search samples for barcode reprint', err);
            setResults([]);
            setSelectedResult(null);
            setError(getApiErrorMessage(err, 'Failed to search for the sample. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    const loadPatient = async (sample: SampleReprintItem) => {
        if (!sample.patient?.pid) {
            setSelectedPatient(null);
            return;
        }

        setPatientLoading(true);

        try {
            const patient = await getPatientById(sample.patient.pid);
            setSelectedPatient(patient);
        } catch (err) {
            console.error('Failed to load patient details for barcode reprint', err);
            setSelectedPatient(null);
        } finally {
            setPatientLoading(false);
        }
    };

    const handleSelectResult = async (sample: SampleReprintItem) => {
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
                patientName: patientDisplayName ?? 'Unknown Patient',
                patientCode: selectedResult.patient?.pid ?? 'No PID',
                testType: selectedResult.testType ?? 'Unknown test',
                testCodes: selectedResult.testCodes ?? [],
                tubeTypes: selectedResult.tubeTypes ?? [],
                tubeColorClass,
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

    const tubeColorClass = selectedResult?.tubeTypes?.[0]
        ? TUBE_COLOR_CLASS[selectedResult.tubeTypes[0]] ?? 'bg-slate-400'
        : 'bg-slate-400';

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
                const data = await searchSamplesForReprint(initialQuery.trim());
                if (cancelled) {
                    return;
                }

                setResults(data);

                if (data.length === 0) {
                    setSelectedResult(null);
                    setError('No matching samples were found for barcode reprint.');
                    return;
                }

                setSelectedResult(data[0]);
                await loadPatient(data[0]);
            } catch (err) {
                if (cancelled) {
                    return;
                }

                console.error('Failed to preload barcode reprint search', err);
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

    return (
        <div>
            <div className="mb-6">
                {returnTo && (
                    <Link
                        href={returnTo}
                        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary transition-colors mb-4"
                    >
                        <span className="material-icons text-base">chevron_left</span>
                        Back to Quality Verification
                    </Link>
                )}
                <h1 className="text-2xl font-bold text-slate-800">Barcode Reprint</h1>
                <p className="text-sm text-slate-500 mt-1">Search real samples and reprint accession barcode labels.</p>
            </div>

            {error && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span>{successMessage}</span>
                        {returnTo && readyToReturn && (
                            <button
                                type="button"
                                onClick={() => router.push(withReturnFlag(returnTo, 'barcodeReprinted', 'true'))}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                            >
                                <span className="material-icons text-sm">check</span>
                                Return to Verification
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 mb-6">
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">qr_code_scanner</span>
                        <input
                            type="text"
                            placeholder="Scan or type Sample ID, Patient ID, Order ID, or test..."
                            className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            onKeyDown={(event) => event.key === 'Enter' && void handleSearch()}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleSearch()}
                        disabled={loading}
                        className="px-5 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-icons text-sm mr-1 align-middle">search</span>
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">Try: `DH-20260506-00100006`, `PAT2026-00001`, or `ORD-20260506-010002`</p>
            </div>

            {selectedResult ? (
                <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Matching Samples</h3>
                            <p className="text-xs text-slate-400 mt-1">{results.length} result(s) found</p>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {results.map((sample) => {
                                const isActive = sample.id === selectedResult.id;

                                return (
                                    <button
                                        key={sample.id}
                                        type="button"
                                        onClick={() => void handleSelectResult(sample)}
                                        className={`w-full text-left px-5 py-4 transition-colors ${
                                            isActive ? 'bg-primary/5' : 'hover:bg-slate-50/70'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-bold text-primary">{sample.sampleId}</p>
                                                <p className="text-sm font-medium text-slate-700 mt-1">{sample.patient?.pid ?? 'Unknown Patient'}</p>
                                                <p className="text-xs text-slate-400 mt-1">{sample.orderId ?? 'Order unavailable'}</p>
                                            </div>
                                            <span
                                                className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold ${
                                                    PRIORITY_COLORS[sample.priority as keyof typeof PRIORITY_COLORS] ??
                                                    'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {formatStatusLabel(sample.priority)}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex items-center gap-2">
                                            <span
                                                className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold ${
                                                    SAMPLE_STATUS_COLORS[sample.status] ?? 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {formatStatusLabel(sample.status)}
                                            </span>
                                            <span className="text-xs text-slate-500">{sample.testType ?? 'Unknown test'}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Sample Details</h3>
                            <div className="space-y-3.5">
                                {[
                                    { label: 'Sample ID', value: selectedResult.sampleId, icon: 'science' },
                                    {
                                        label: 'Patient',
                                        value: patientLoading
                                            ? 'Loading patient...'
                                            : `${patientDisplayName ?? 'Unknown Patient'} (${selectedResult.patient?.pid ?? 'No PID'})`,
                                        icon: 'person',
                                    },
                                    { label: 'Test Type', value: selectedResult.testType ?? 'Unknown test', icon: 'biotech' },
                                    { label: 'Order No', value: selectedResult.orderId ?? 'Unavailable', icon: 'tag' },
                                    {
                                        label: 'Collected',
                                        value: selectedResult.collectedAt
                                            ? `${new Date(selectedResult.collectedAt).toLocaleString()}${selectedResult.collectedBy ? ` by ${selectedResult.collectedBy}` : ''}`
                                            : 'Collection details unavailable',
                                        icon: 'schedule',
                                    },
                                    { label: 'Status', value: formatStatusLabel(selectedResult.status), icon: 'verified' },
                                ].map((row) => (
                                    <div key={row.label} className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                            <span className="material-icons text-sm text-slate-400">{row.icon}</span>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400">{row.label}</p>
                                            <p className="text-sm font-medium text-slate-700">{row.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Label Preview</h3>
                            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-5 mb-5">
                                <div className="flex items-start gap-4">
                                    <div className={`w-3 h-16 rounded-full ${tubeColorClass}`} />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2 gap-2">
                                            <p className="text-sm font-bold text-slate-800">{selectedResult.sampleId}</p>
                                            <p className="text-xs text-slate-400">{selectedResult.orderId ?? 'No order'}</p>
                                        </div>
                                        <p className="text-xs text-slate-600 mb-1">
                                            {patientDisplayName ?? 'Unknown Patient'} • {selectedResult.patient?.pid ?? 'No PID'}
                                        </p>
                                        <p className="text-xs text-slate-500 mb-2">{selectedResult.testType ?? 'Unknown test'}</p>
                                        <div className="flex gap-1 flex-wrap">
                                            {(selectedResult.testCodes ?? []).map((code) => (
                                                <span
                                                    key={code}
                                                    className="text-[9px] bg-white text-slate-500 px-1.5 py-0.5 rounded border border-slate-200"
                                                >
                                                    {code}
                                                </span>
                                            ))}
                                            {(selectedResult.tubeTypes ?? []).length > 0 && (
                                                <span className="text-[9px] bg-white text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                                    {(selectedResult.tubeTypes ?? []).join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-center mt-4 gap-[1px]">
                                    {buildBarcodePattern(selectedResult.sampleId).map((width, index) => (
                                        <div
                                            key={`${selectedResult.sampleId}-${index}`}
                                            className="bg-slate-800 rounded-[0.5px]"
                                            style={{ width, height: 32 }}
                                        />
                                    ))}
                                </div>
                                <p className="text-center text-[10px] text-slate-400 mt-1">{selectedResult.sampleId}</p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => void handlePrint()}
                                    disabled={recordingPrint}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-icons text-sm">print</span>
                                    {recordingPrint ? 'Saving…' : 'Print Label'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handlePrint()}
                                    disabled={recordingPrint}
                                    className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-icons text-sm">download</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12 text-center">
                    <span className="material-icons text-5xl text-slate-200 mb-3">qr_code_scanner</span>
                    <p className="text-slate-400">Search for a real sample to view and reprint its barcode label.</p>
                </div>
            )}

            {printQueue.length > 0 && (
                <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-icons text-emerald-600">print</span>
                        <p className="text-sm font-bold text-emerald-700">Print Queue ({printQueue.length})</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {printQueue.map((id) => (
                            <span
                                key={id}
                                className="text-xs bg-white text-emerald-700 px-2 py-1 rounded-lg border border-emerald-200 font-medium"
                            >
                                {id}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

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
    tubeColorClass: string;
};

function openPrintWindow(payload: PrintWindowPayload) {
    const printWindow = window.open('', '_blank', 'width=480,height=640');
    if (!printWindow) {
        return false;
    }

    const tubeColor = resolveTubeColor(payload.tubeColorClass);
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
      background: ${tubeColor};
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
          <div style="font-size:13px;color:#94a3b8;">${escapeHtml(payload.orderId)}</div>
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

function resolveTubeColor(colorClass: string) {
    switch (colorClass) {
        case 'bg-purple-500':
            return '#a855f7';
        case 'bg-red-500':
            return '#ef4444';
        case 'bg-blue-500':
            return '#3b82f6';
        case 'bg-amber-400':
            return '#fbbf24';
        case 'bg-slate-500':
            return '#64748b';
        default:
            return '#94a3b8';
    }
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
