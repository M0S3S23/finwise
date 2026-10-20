import { clsx, type ClassValue } from 'clsx';
export const cn = (...c: ClassValue[]) => clsx(c);

export function toCSV(rows: Record<string, unknown>[], columns: { key: string; label: string }[]) {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(r[c.key])).join(',')).join('\r\n');
  return '﻿' + head + '\r\n' + body;
}
