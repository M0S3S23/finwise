'use client';
import { PERIODS, type Period } from '@/lib/dates';
import { Select } from './ui';

export function PeriodSelect({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as Period)} className="w-auto min-w-[150px]" aria-label="Period">
      {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
    </Select>
  );
}
