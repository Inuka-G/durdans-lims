'use client';

const DEPARTMENTS = ['All Departments', 'Haematology', 'Biochemistry', 'Immunology', 'Microbiology'];
const TEST_TYPES = ['All Test Types', 'Full Blood Count', 'Lipid Profile', 'Thyroid Panel', 'HbA1c', 'Blood Culture', 'Urine Culture', 'Serum Electrolytes'];

interface MLTFilterBarProps {
    searchQuery: string;
    department: string;
    testType: string;
    onSearch: (q: string) => void;
    onDepartment: (d: string) => void;
    onTestType: (t: string) => void;
    mode: 'worklist' | 'all';
    onPrintBatch?: () => void;
    onNewEntry?: () => void;
    onPrint?: () => void;
}

export default function MLTFilterBar({
    searchQuery, department, testType,
    onSearch, onDepartment, onTestType,
    mode, onPrintBatch, onNewEntry, onPrint,
}: MLTFilterBarProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                <input
                    type="text"
                    placeholder="Search sample ID, patient..."
                    value={searchQuery}
                    onChange={(e) => onSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
            </div>
            <select
                value={department}
                onChange={(e) => onDepartment(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
                value={testType}
                onChange={(e) => onTestType(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
                {TEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            {mode === 'worklist' && (
                <>
                    {onPrintBatch && (
                        <button
                            onClick={onPrintBatch}
                            className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            <span className="material-icons text-base">print</span>
                            Print Batch
                        </button>
                    )}
                    {onNewEntry && (
                        <button
                            onClick={onNewEntry}
                            className="flex items-center gap-1.5 px-3 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all"
                        >
                            <span className="material-icons text-base">add</span>
                            New Entry
                        </button>
                    )}
                </>
            )}

            {mode === 'all' && onPrint && (
                <button
                    onClick={onPrint}
                    className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-all"
                >
                    <span className="material-icons text-base">print</span>
                    Print List
                </button>
            )}
        </div>
    );
}
