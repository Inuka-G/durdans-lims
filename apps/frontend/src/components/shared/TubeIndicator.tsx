'use client';

/** Grey is not a tube colour — it flags a tube type with no stocked container to read a colour from. */
const NEUTRAL_TUBE_COLOR = '#9ca3af';

export interface TubeIndicatorTube {
    code: string;
    color?: string | null;
    label?: string;
}

interface TubeIndicatorProps {
    tubes: TubeIndicatorTube[];
}

export default function TubeIndicator({ tubes }: TubeIndicatorProps) {
    return (
        <div className="flex gap-1">
            {tubes.map((tube) => (
                <div
                    key={tube.code}
                    className="w-4 h-4 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: tube.color?.trim() || NEUTRAL_TUBE_COLOR }}
                    title={tube.label ?? tube.code.replace(/_/g, ' ')}
                />
            ))}
        </div>
    );
}
