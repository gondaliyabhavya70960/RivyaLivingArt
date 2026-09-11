import { BRIEF_SECTIONS, type BriefSection } from '@/lib/supabase/schemas/research-direction'

import { type EvidenceType, type ObservedFigure } from './capture'

/**
 * A brief as Markdown — the same document the print view renders, for `research:direction-export`.
 *
 * THE HEADER STATES WHAT THIS IS. "Internal research document — never published" is the first
 * line of every export, and every observed figure carries its coverage and the words "observed in
 * competitor research" on the page, because a printed number without them reads as a
 * specification. No price, dimension or material is ever written as a Rivya fact: the intended
 * sections are the person's prose, reproduced verbatim, and nothing else is generated.
 */

export const INTERNAL_DOCUMENT_HEADER = 'Internal research document — never published'
export const OBSERVED_LABEL = 'observed in competitor research'

export const SECTION_TITLES: Record<BriefSection, string> = {
  intent: 'Intent — why now',
  scale_intent: 'Scale intent',
  form_language: 'Form language',
  material_direction: 'Material direction',
  finish_direction: 'Finish direction',
  constraints: 'Constraints',
  open_questions: 'Open questions',
  not_doing: 'Not doing',
}

export interface ExportBrief {
  readonly title: string
  readonly slug: string
  readonly status: string
  readonly targetCategorySlug: string | null
  readonly approvedAt: string | null
  readonly updatedAt: string
  readonly sections: Readonly<Record<BriefSection, string | null>>
}

export interface ExportEvidence {
  readonly type: EvidenceType
  readonly label: string
  readonly rationale: string
  readonly capturedAt: string
  readonly drift: boolean
}

export function formatFigure(figure: ObservedFigure): string {
  if (figure.value === null) return '—'
  switch (figure.unit) {
    case 'minor':
      return `${figure.currency ?? ''} ${(figure.value / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`.trim()
    case 'mm':
      return `${String(Math.round(figure.value))} mm`
    case 'pct':
      return `${String(figure.value)} %`
    default:
      return String(figure.value)
  }
}

export function renderBriefMarkdown(input: {
  readonly brief: ExportBrief
  readonly figures: readonly ObservedFigure[]
  readonly evidence: readonly ExportEvidence[]
}): string {
  const { brief, figures, evidence } = input
  const lines: string[] = []
  lines.push(`> ${INTERNAL_DOCUMENT_HEADER}`)
  lines.push('')
  lines.push(`# ${brief.title}`)
  lines.push('')
  lines.push(
    `Status: ${brief.status} · Category: ${brief.targetCategorySlug ?? 'unfiled'} · Updated: ${brief.updatedAt.slice(0, 10)}${
      brief.approvedAt === null ? '' : ` · Approved: ${brief.approvedAt.slice(0, 10)}`
    }`,
  )
  lines.push('')
  lines.push('## Direction (intended — Rivya prose, not a specification)')
  lines.push('')
  for (const section of BRIEF_SECTIONS) {
    lines.push(`### ${SECTION_TITLES[section]}`)
    lines.push('')
    const text = brief.sections[section]
    lines.push(text === null || text.trim() === '' ? '_(not yet written)_' : text.trim())
    lines.push('')
  }
  lines.push(`## Observed figures (${OBSERVED_LABEL})`)
  lines.push('')
  if (figures.length === 0) {
    lines.push('_No analytics snapshot attached._')
  } else {
    lines.push('| Figure | Value | Coverage |')
    lines.push('|---|---|---|')
    for (const figure of figures) {
      lines.push(
        `| ${figure.label} | ${formatFigure(figure)} | ${String(figure.coverage.n)} of ${String(figure.coverage.denominator)} (${String(figure.coverage.coveragePct)} %), as of ${figure.coverage.asOf.slice(0, 10)} — ${OBSERVED_LABEL} |`,
      )
    }
  }
  lines.push('')
  lines.push('## Evidence')
  lines.push('')
  if (evidence.length === 0) {
    lines.push('_No evidence attached._')
  } else {
    for (const item of evidence) {
      lines.push(
        `- **${item.type}** — ${item.label} (attached ${item.capturedAt.slice(0, 10)}${item.drift ? ', changed since attachment' : ''})`,
      )
      lines.push(`  Rationale: ${item.rationale.trim()}`)
    }
  }
  lines.push('')
  lines.push(
    `_${INTERNAL_DOCUMENT_HEADER}. Whether Rivya can produce anything described here is not asserted by this document._`,
  )
  lines.push('')
  return lines.join('\n')
}
