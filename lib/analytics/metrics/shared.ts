import type { ChartDatumRow, MetricValue } from '@/lib/supabase/schemas/analytics'

import type { MetricOutcome } from './types'

/** Whole-number percent; 0 when the denominator is 0 — never 100 over nothing. */
export function percent(n: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((n / denominator) * 100)
}

export function available(n: number, denominator: number, value: MetricValue): MetricOutcome {
  return { availability: 'AVAILABLE', n, denominator, value }
}

export function unavailable(
  reason: string,
  n: number | null = null,
  denominator: number | null = null,
): MetricOutcome {
  return { availability: 'UNAVAILABLE', reason, n, denominator }
}

/** Counts by a key, in first-seen order. */
export function tally<T>(items: readonly T[], keyOf: (item: T) => string | null): ChartDatumRow[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = keyOf(item)
    if (key === null) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value }))
}

export function topN(data: readonly ChartDatumRow[], limit: number): ChartDatumRow[] {
  return [...data]
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit)
}

export function daysBetween(fromIso: string, to: Date): number {
  const from = Date.parse(fromIso)
  if (Number.isNaN(from)) return 0
  return Math.max(0, Math.floor((to.getTime() - from) / 86_400_000))
}

export function withinDays(iso: string, now: Date, days: number): boolean {
  return daysBetween(iso, now) < days
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const low = sorted[mid - 1]
  const high = sorted[mid]
  if (high === undefined) return null
  return sorted.length % 2 === 0 && low !== undefined ? (low + high) / 2 : high
}

/** ISO week label `2026-W37` for a date, computed in UTC. */
export function isoWeekLabel(iso: string): string {
  const date = new Date(iso)
  const day = (date.getUTCDay() + 6) % 7
  const thursday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day + 3),
  )
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4))
  const week =
    1 +
    Math.round(
      ((thursday.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    )
  return `${String(thursday.getUTCFullYear())}-W${String(week).padStart(2, '0')}`
}

export function bandLabel(value: number, edges: readonly number[], unit: string): string {
  let lower = 0
  for (const edge of edges) {
    if (value < edge)
      return lower === 0 ? `< ${String(edge)} ${unit}` : `${String(lower)}–${String(edge)} ${unit}`
    lower = edge
  }
  return `≥ ${String(lower)} ${unit}`
}

export function numberField(record: Readonly<Record<string, unknown>>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function arrayField(
  record: Readonly<Record<string, unknown>>,
  key: string,
): readonly unknown[] {
  const value = record[key]
  return Array.isArray(value) ? value : []
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
