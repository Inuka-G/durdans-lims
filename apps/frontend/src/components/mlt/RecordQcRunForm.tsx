'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    getInstrumentRegistry,
    getQcAnalytes,
    recordQcRun,
    type InstrumentOption,
    type QcAnalyteOption,
    type QcRunOutcome
} from '@/lib/api';
import Button from '@/components/ui/Button';
import { FormSection, InputField, SelectField } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

/**
 * Records an internal-QC run.
 *
 * <p>This exists because QC now gates release: a result whose governing control
 * failed, went stale, or was never recorded is held at verification. Before the
 * gate there was nowhere in the application to record a control at all — the
 * endpoint existed and no screen called it — so the dashboard showed seeded demo
 * runs and nothing was ever actually controlled.
 *
 * <p>Instrument and analyte are pickers rather than text inputs on purpose. Both
 * are join keys for the gate; a typed instrument name or a misremembered LOINC
 * produces a control that looks recorded and governs nothing.
 */
export default function RecordQcRunForm({ onRecorded }: { onRecorded: () => void }) {
    const [instruments, setInstruments] = useState<InstrumentOption[]>([]);
    const [analytes, setAnalytes] = useState<QcAnalyteOption[]>([]);
    const [loadingOptions, setLoadingOptions] = useState(true);

    const [instrument, setInstrument] = useState('');
    const [loincCode, setLoincCode] = useState('');
    const [controlLevel, setControlLevel] = useState('L1');
    const [controlLot, setControlLot] = useState('');
    const [measuredValue, setMeasuredValue] = useState('');
    const [mean, setMean] = useState('');
    const [sd, setSd] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [outcome, setOutcome] = useState<QcRunOutcome | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [inst, an] = await Promise.all([getInstrumentRegistry(), getQcAnalytes()]);
                if (cancelled) return;
                // Bench methods have no analyser, so no analyser control can be run.
                setInstruments(inst.filter((i) => i.qcRequired));
                setAnalytes(an);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Could not load instruments and analytes.');
                }
            } finally {
                if (!cancelled) setLoadingOptions(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const analyteName = useMemo(
        () => analytes.find((a) => a.loincCode === loincCode)?.name ?? '',
        [analytes, loincCode]
    );

    const numeric = (v: string) => (v.trim() === '' ? null : Number(v));
    const canSubmit =
        instrument !== '' &&
        loincCode !== '' &&
        controlLevel.trim() !== '' &&
        numeric(measuredValue) !== null &&
        numeric(mean) !== null &&
        Number(sd) > 0;

    const submit = async () => {
        if (!canSubmit) return;
        try {
            setSubmitting(true);
            setError(null);
            setOutcome(null);
            const result = await recordQcRun({
                instrument,
                analyte: analyteName || loincCode,
                loincCode,
                controlLevel: controlLevel.trim(),
                controlLot: controlLot.trim() || undefined,
                measuredValue: Number(measuredValue),
                mean: Number(mean),
                sd: Number(sd)
            });
            setOutcome(result);
            setMeasuredValue('');
            onRecorded();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not record this QC run.');
        } finally {
            setSubmitting(false);
        }
    };

    const outcomeStyle =
        outcome?.status === 'FAIL'
            ? 'border-status-danger-edge bg-status-danger-bg text-status-danger-fg'
            : outcome?.status === 'WARN'
              ? 'border-status-pending-edge bg-status-pending-bg text-status-pending-fg'
              : 'border-status-verified-edge bg-status-verified-bg text-status-verified-fg';

    return (
        <FormSection
            title="Record a QC run"
            description="Results are held at verification until the control governing their analyser and analyte has passed."
            className="mb-6"
        >
            {loadingOptions ? (
                <div className="sm:col-span-2" role="status" aria-live="polite">
                    <span className="sr-only">Loading instruments and analytes…</span>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden="true">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i}>
                                <div className="mb-1 h-3 w-24 rounded bg-skeleton" />
                                <div className="h-9 w-full rounded-md bg-skeleton" />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    <SelectField
                        label="Instrument"
                        required
                        value={instrument}
                        onChange={(e) => setInstrument(e.target.value)}
                    >
                        <option value="">Select…</option>
                        {instruments.map((i) => (
                            <option key={i.code} value={i.code}>
                                {i.name} ({i.code})
                            </option>
                        ))}
                    </SelectField>

                    <SelectField
                        label="Analyte"
                        required
                        value={loincCode}
                        onChange={(e) => setLoincCode(e.target.value)}
                    >
                        <option value="">Select…</option>
                        {analytes.map((a) => (
                            <option key={a.loincCode} value={a.loincCode}>
                                {a.name} ({a.loincCode})
                            </option>
                        ))}
                    </SelectField>

                    <InputField
                        label="Control level"
                        required
                        value={controlLevel}
                        onChange={(e) => setControlLevel(e.target.value)}
                        placeholder="L1"
                    />

                    <InputField
                        label="Control lot"
                        hint="Optional"
                        value={controlLot}
                        onChange={(e) => setControlLot(e.target.value)}
                    />

                    <InputField
                        label="Measured value"
                        required
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={measuredValue}
                        onChange={(e) => setMeasuredValue(e.target.value)}
                    />

                    <InputField
                        label="Target mean"
                        required
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={mean}
                        onChange={(e) => setMean(e.target.value)}
                    />

                    <InputField
                        label="SD"
                        required
                        hint="Must be greater than zero."
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        value={sd}
                        onChange={(e) => setSd(e.target.value)}
                    />

                    {error && (
                        <div
                            role="alert"
                            className="rounded-md border border-status-danger-edge bg-status-danger-bg p-3 text-sm text-status-danger-fg sm:col-span-2"
                        >
                            {error}
                        </div>
                    )}

                    {outcome && (
                        <div
                            role="status"
                            aria-live="polite"
                            className={cn('rounded-md border p-3 text-sm sm:col-span-2', outcomeStyle)}
                        >
                            <span className="font-semibold">Westgard: {outcome.status}</span>
                            {outcome.violations.length > 0 && <> — {outcome.violations.join(', ')}</>}
                            {outcome.status === 'FAIL' && (
                                <p className="mt-1">
                                    Results on this analyser for this analyte are now held until a passing
                                    control is recorded, or a supervisor releases over the failure.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end border-t border-edge pt-4 sm:col-span-2">
                        <Button
                            variant="primary"
                            onClick={() => void submit()}
                            disabled={!canSubmit || submitting}
                            loading={submitting}
                        >
                            {submitting ? 'Recording…' : 'Record QC run'}
                        </Button>
                    </div>
                </>
            )}
        </FormSection>
    );
}
