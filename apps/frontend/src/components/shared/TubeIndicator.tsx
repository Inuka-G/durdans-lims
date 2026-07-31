'use client';

const TUBE_COLOR_MAP: Record<string, string> = {
    EDTA:         'bg-purple-500',
    SST:          'bg-yellow-400',
    HEPARIN:      'bg-green-500',
    CITRATE:      'bg-blue-400',
    FLUORIDE:     'bg-gray-400',
    PLAIN:        'bg-red-400',
    URINE:        'bg-yellow-300',
};

const TUBE_LABELS: Record<string, string> = {
    EDTA:     'EDTA (Purple)',
    SST:      'SST (Gold)',
    HEPARIN:  'Heparin (Green)',
    CITRATE:  'Citrate (Blue)',
    FLUORIDE: 'Fluoride (Gray)',
    PLAIN:    'Plain (Red)',
    URINE:    'Urine (Yellow)',
};

interface TubeIndicatorProps {
    tubes: string[];
}

export default function TubeIndicator({ tubes }: TubeIndicatorProps) {
    return (
        <div className="flex gap-1">
            {tubes.map((t) => (
                <div
                    key={t}
                    className={`w-4 h-4 rounded-full ${TUBE_COLOR_MAP[t] ?? 'bg-slate-400'} border border-white shadow-sm`}
                    title={TUBE_LABELS[t] ?? t}
                />
            ))}
        </div>
    );
}
