'use client';

import { useId } from 'react';
import { Search } from 'lucide-react';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { CONTROL_CLASS } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

interface WorklistFiltersProps {
    onSearch: (q: string) => void;
    onPriorityChange: (p: string) => void;
    selectedPriority: string;
}

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
    { value: 'ALL', label: 'All priorities' },
    { value: 'STAT', label: 'STAT' },
    { value: 'URGENT', label: 'Urgent' },
    { value: 'NORMAL', label: 'Normal' },
];

export default function WorklistFilters({ onSearch, onPriorityChange, selectedPriority }: WorklistFiltersProps) {
    const searchId = useId();

    return (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full min-w-0 sm:w-auto sm:flex-1">
                <label htmlFor={searchId} className="sr-only">
                    Search worklist
                </label>
                <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint"
                    aria-hidden="true"
                />
                <input
                    id={searchId}
                    type="search"
                    placeholder="Search patient name, ID or order"
                    onChange={(e) => onSearch(e.target.value)}
                    className={cn(CONTROL_CLASS, 'h-9 pl-9')}
                />
            </div>
            <SegmentedControl
                value={selectedPriority}
                onChange={onPriorityChange}
                options={PRIORITY_OPTIONS}
                ariaLabel="Filter by priority"
                size="sm"
                className="shrink-0"
            />
        </div>
    );
}
