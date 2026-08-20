'use client';

import { useId } from 'react';
import { Plus, Printer, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import { CONTROL_CLASS, SelectField } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

const DEPARTMENTS = ['All Departments', 'Haematology', 'Biochemistry', 'Immunology', 'Microbiology'];
const TEST_TYPES = ['All Test Types', 'Full Blood Count', 'Lipid Profile', 'Thyroid Panel', 'HbA1c', 'Blood Culture', 'Urine Culture', 'Serum Electrolytes'];

/** Display labels only — option values stay unchanged so page filters keep matching. */
const OPTION_LABELS: Record<string, string> = {
    'All Departments': 'All departments',
    'All Test Types': 'All test types',
};

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
    const searchId = useId();

    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
                <label htmlFor={searchId} className="sr-only">Search sample ID or patient</label>
                <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint"
                    aria-hidden="true"
                />
                <input
                    id={searchId}
                    type="search"
                    placeholder="Search sample ID, patient…"
                    value={searchQuery}
                    onChange={(e) => onSearch(e.target.value)}
                    className={cn(CONTROL_CLASS, 'h-9 pl-9')}
                />
            </div>

            <SelectField
                label="Department"
                hideLabel
                value={department}
                onChange={(e) => onDepartment(e.target.value)}
                className="sm:w-44"
            >
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{OPTION_LABELS[d] ?? d}</option>)}
            </SelectField>

            <SelectField
                label="Test type"
                hideLabel
                value={testType}
                onChange={(e) => onTestType(e.target.value)}
                className="sm:w-44"
            >
                {TEST_TYPES.map((t) => <option key={t} value={t}>{OPTION_LABELS[t] ?? t}</option>)}
            </SelectField>

            {mode === 'worklist' && (
                <>
                    {onPrintBatch && (
                        <Button variant="secondary" icon={Printer} onClick={onPrintBatch}>
                            Print batch
                        </Button>
                    )}
                    {onNewEntry && (
                        <Button variant="primary" icon={Plus} onClick={onNewEntry}>
                            New entry
                        </Button>
                    )}
                </>
            )}

            {mode === 'all' && onPrint && (
                <Button variant="secondary" icon={Printer} onClick={onPrint}>
                    Print list
                </Button>
            )}
        </div>
    );
}
