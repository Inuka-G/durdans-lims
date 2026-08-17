'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { getCollectionHistory, printSampleLabel } from '@/lib/api';
import { getBarcodeBars, openPhlebotomySpecimenLabelPrint } from '@/lib/phlebotomy-label-print';
import { TUBE_COLOR_MAP } from '@/constants/sample-lifecycle';
import type { LabelItem } from '@/types/sample-lifecycle';

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

export default function LabelReprintPage() {
    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState(() => searchParams.get('sampleId') ?? '');
    const [labels, setLabels] = useState<LabelRow[]>([]);
    const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);

    useEffect(() => {
        const loadLabels = async () => {
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
                            collectedAt: item?.collectedAt
                                ? new Date(item.collectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '-',
                            printCount: Number(item?.printCount ?? 0),
                            tubeTypeCode: String(tubeTypeCode),
                        };
                    });
                setLabels(rows);
            } catch (error) {
                console.error('Failed to load label list:', error);
                toast.error('Failed to load labels. Please try again.');
                setLabels([]);
            }
        };

        loadLabels();
    }, []);

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

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Label Print</h1>
                <p className="text-sm text-slate-500 mt-1">Search and print sample barcode labels. Each print is recorded for audit.</p>
            </div>

            {/* Search */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 mb-6">
                <div className="relative">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                    <input type="text" placeholder="Search by Sample ID, Patient ID, or Patient Name" className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
            </div>

            {/* Label Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filtered.length === 0 ? (
                    <div className="col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12 text-center text-slate-400">No labels found matching your search.</div>
                ) : filtered.map((label) => (
                    <div key={label.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <p className="font-bold text-slate-800">{label.sampleId}</p>
                                <p className="text-sm text-slate-500">{label.patientName} • {label.pid}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full ${label.tubeColor} border border-white shadow-sm`} />
                                <span className="text-xs text-slate-400">{label.tubeType}</span>
                            </div>
                        </div>

                        {/* Label Preview */}
                        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-10 rounded-full ${label.tubeColor}`} />
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-700">{label.sampleId}</p>
                                    <p className="text-[10px] text-slate-500">{label.patientName}</p>
                                    <div className="flex gap-1 mt-1">{label.testCodes.map(c => <span key={c} className="text-[9px] bg-white text-slate-500 px-1 py-0.5 rounded border border-slate-200">{c}</span>)}</div>
                                </div>
                                {/* Barcode visual */}
                                <div className="flex gap-[1px]">
                                    {getBarcodeBars(label.sampleId, 20).map((width, i) => (
                                        <div key={i} className={`bg-slate-800 rounded-[0.5px]`} style={{ width, height: 28 }} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="text-xs text-slate-400">
                                <span>Collected: {label.collectedAt}</span>
                                <span className="ml-3">Printed: {label.printCount}×</span>
                            </div>
                            <button disabled={loadingSampleId === label.sampleUuid} onClick={() => void handlePrint(label)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                                <span className="material-icons text-sm">{loadingSampleId === label.sampleUuid ? 'hourglass_top' : 'print'}</span>
                                {loadingSampleId === label.sampleUuid ? 'Printing...' : 'Print Label'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
