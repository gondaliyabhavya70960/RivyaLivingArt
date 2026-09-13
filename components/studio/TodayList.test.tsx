import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TodayList, type TodayRow } from './TodayList'

/**
 * The Overview's work list — §12's rule stated from the component's side: a failed query renders
 * unreadable, never `0`.
 *
 * WHY EVERY ASSERTION IS ABOUT THE DIFFERENCE BETWEEN THE THREE STATES rather than about layout.
 * A count of 3, a count of 0 and a count that never came back are three different claims about the
 * business, and the only one of them that can mislead silently is the third: `null` rendered as
 * zero tells an owner their queue is clear on the strength of a query that failed.
 */

function row(over: Partial<TodayRow> & Pick<TodayRow, 'id' | 'count'>): TodayRow {
  return { label: `Row ${over.id}`, href: `/studio/${over.id}`, ...over }
}

describe('TodayList', () => {
  it('shows a sourced count as the figure, grouped for an Indian reader', () => {
    render(<TodayList rows={[row({ id: 'sections', count: 100000 })]} />)
    // 1,00,000 — `en-IN`, as StatCard does. Not 100,000.
    expect(screen.getByText('1,00,000')).toBeInTheDocument()
  })

  it('renders a failed read as unreadable, not as zero', () => {
    const { container } = render(<TodayList rows={[row({ id: 'inquiries', count: null })]} />)
    expect(container.querySelector('[data-today-count-unreadable]')).not.toBeNull()
    expect(container.querySelector('[data-today-count-clear]')).toBeNull()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('renders a sourced zero in its own words, distinct from a failed read', () => {
    const { container } = render(<TodayList rows={[row({ id: 'sources', count: 0 })]} />)
    expect(container.querySelector('[data-today-count-clear]')).not.toBeNull()
    expect(container.querySelector('[data-today-count-unreadable]')).toBeNull()
  })

  it('says everything is clear only when every row actually read its table', () => {
    const { container: allZero } = render(
      <TodayList rows={[row({ id: 'a', count: 0 }), row({ id: 'b', count: 0 })]} />,
    )
    expect(allZero.querySelector('[data-today-all-clear]')).not.toBeNull()

    /*
     * THE CASE THAT MATTERS. One unreadable row among zeros and the honest statement is nothing at
     * all: "you are done" would be asserted on the strength of a query that never answered.
     */
    const { container: oneFailed } = render(
      <TodayList rows={[row({ id: 'a', count: 0 }), row({ id: 'b', count: null })]} />,
    )
    expect(oneFailed.querySelector('[data-today-all-clear]')).toBeNull()
  })

  it('makes every row a link to the screen that clears it', () => {
    render(
      <TodayList
        rows={[
          row({ id: 'inquiries', count: 2, href: '/studio/inquiries/all' }),
          row({ id: 'sources', count: 1, href: '/studio/research/sources' }),
        ]}
      />,
    )
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    for (const link of links) {
      // jsdom computes no layout, so the 44px target is checked as the class that produces it.
      expect(link.className).toContain('min-h-11')
      expect(link.getAttribute('href')).toMatch(/^\/studio\//u)
    }
  })

  it('says so plainly when a role can act on none of the four', () => {
    // Not an error and not a zero: this reader's work is elsewhere, and a bare empty box would
    // read as a broken query.
    const { container } = render(<TodayList rows={[]} />)
    expect(container.querySelector('[data-today-no-rows]')).not.toBeNull()
    expect(container.querySelector('[data-today-all-clear]')).toBeNull()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('renders a row’s detail beneath it', () => {
    render(
      <TodayList
        rows={[
          row({ id: 'verifications', count: 4, detail: <p data-detail="">Where to clear</p> }),
        ]}
      />,
    )
    expect(screen.getByText('Where to clear')).toBeInTheDocument()
  })
})
