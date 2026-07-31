'use client';

interface WorklistFiltersProps {
    onSearch: (q: string) => void;
    onPriorityChange: (p: string) => void;
    selectedPriority: string;
}

const PRIORITIES = ['ALL', 'STAT', 'URGENT', 'NORMAL'];

export default function WorklistFilters({ onSearch, onPriorityChange, selectedPriority }: WorklistFiltersProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1">
                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                <input
                    type="text"
                    placeholder="Search patient name, ID, order..."
                    onChange={(e) => onSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
            </div>
            <div className="flex gap-2 flex-wrap">
                {PRIORITIES.map((p) => (
                    <button
                        key={p}
                        onClick={() => onPriorityChange(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            selectedPriority === p
                                ? 'bg-primary text-white shadow-sm'
                                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {p === 'ALL' ? 'All Priorities' : p}
                    </button>
                ))}
            </div>
        </div>
    );
}
