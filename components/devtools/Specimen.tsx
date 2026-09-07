import type { ReactNode } from 'react'

/**
 * Gallery scaffolding. Development-only: nothing here is imported by a product route,
 * and the pages that use it call notFound() in a production build.
 *
 * The labels below are the one place in components/ where literal strings are correct —
 * they name the design system to a developer and are never seen by a visitor, so the
 * "copy comes from the CMS" rule (D2) does not apply.
 */
export function Specimen({
  name,
  note,
  children,
}: {
  name: string
  note?: string
  children: ReactNode
}) {
  return (
    <section className="border-line border-b py-8" aria-labelledby={`sp-${name}`}>
      <h3 id={`sp-${name}`} className="text-ink font-mono text-sm tracking-technical">
        {name}
      </h3>
      {note ? (
        <p className="text-ink-tertiary mt-1 max-w-(--rv-container-prose) text-sm">{note}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-end gap-6">{children}</div>
    </section>
  )
}

export function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-ink-tertiary font-mono text-2xs uppercase tracking-eyebrow">
        {label}
      </span>
      {children}
    </div>
  )
}

export function SchemeBand({
  scheme,
  children,
}: {
  scheme: 'deep' | 'ink' | 'bone'
  children: ReactNode
}) {
  return (
    <div className={`rv-scheme-${scheme} bg-surface text-ink rounded-md p-6`}>
      <p className="text-ink-tertiary mb-4 font-mono text-2xs uppercase tracking-eyebrow">
        {scheme}
      </p>
      {children}
    </div>
  )
}
