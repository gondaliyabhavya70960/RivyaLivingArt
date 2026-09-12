import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { SectionList } from '@/components/sections/SectionList'
import { SECTION_RENDERERS } from '@/components/sections/registry'
import type { PageReferences } from '@/lib/cms/references'
import { siteStrings } from '@/lib/cms/strings'
import { BLOCK_TYPES } from '@/lib/cms/block-types'
import type { Faq, GlobalContent, PageSection } from '@/lib/supabase/schemas'

/**
 * The seven blocks Phase 45 promoted from PLANNED to BUILT.
 *
 * WHY A FILE OF THEIR OWN rather than rows in `cms-sections.test.tsx`. That file asserts what every
 * section shares — the registries agree, the shell paints, a scheme resolves. These seven each have
 * a rule that is theirs alone and that a shared test cannot express: a withheld step is removed
 * BEFORE the numbering runs, a WhatsApp link needs two strings to resolve before it may exist at
 * all, an unattributed quotation is the safe case, an unknown `layout_variant` must fall through
 * rather than render nothing. Those are the assertions worth having, and they belong together.
 */

beforeEach(() => {
  /*
   * `buildDirectContactUrl` reads the number through `requiredEnv` and THROWS when it is unset —
   * the project's posture for a required variable, and the reason `contact-details` needs one here.
   * No test may depend on a real number, so this is the same placeholder
   * `tests/unit/whatsapp-template.test.ts` uses.
   */
  process.env['NEXT_PUBLIC_WHATSAPP_NUMBER'] = '+91 70960 36250'
})

const CLOUD = 'rivya-test'
const SECTION_ID = '00000000-0000-4000-8000-000000000001'
const LIVE_PATHS = new Set(['/contact', '/process'])

function section(over: Partial<PageSection> = {}): PageSection {
  return {
    id: SECTION_ID,
    page_id: '00000000-0000-4000-8000-0000000000ff',
    block_type: 'statement',
    position: 0,
    is_visible: true,
    theme: null,
    layout_variant: null,
    eyebrow: null,
    heading: null,
    heading_highlight: null,
    body: null,
    supporting: null,
    cta_label: null,
    cta_url: null,
    cta_secondary_label: null,
    cta_secondary_url: null,
    media_desktop_id: null,
    media_mobile_id: null,
    media_alt_override: null,
    media_slot_key: null,
    payload: {},
    field_classifications: {},
    publish_at: null,
    unpublish_at: null,
    schedule_state: 'IDLE',
    schedule_attempts: 0,
    schedule_error: null,
    schedule_last_attempt_at: null,
    status: 'PUBLISHED',
    fact_classification: 'GENERIC_SAFE',
    owner_verification: 'NOT_REQUIRED',
    ...over,
  } as PageSection
}

function global_(group: string, key: string, value: string): GlobalContent {
  return {
    id: `${group}-${key}`,
    group_key: group,
    key,
    label: null,
    value,
    description: null,
    is_enabled: true,
  } as GlobalContent
}

const STRINGS = siteStrings([
  global_('ERROR', 'media_unavailable.label', 'Image unavailable'),
  global_('ACTION_LABEL', 'media.play', 'Play'),
  global_('ACTION_LABEL', 'discuss_on_whatsapp', 'Discuss on WhatsApp'),
  global_('WHATSAPP_TEMPLATE', 'direct', 'Hello Rivya.'),
])

/** The same strings minus the WhatsApp pair, for the "a missing string means no link" rule. */
const STRINGS_WITHOUT_WHATSAPP = siteStrings([
  global_('ERROR', 'media_unavailable.label', 'Image unavailable'),
  global_('ACTION_LABEL', 'media.play', 'Play'),
])

function renderSection(
  one: PageSection,
  options: { readonly references?: PageReferences; readonly strings?: typeof STRINGS } = {},
) {
  return render(
    <SectionList
      livePaths={LIVE_PATHS}
      sections={[one]}
      assets={new Map()}
      strings={options.strings ?? STRINGS}
      cloudName={CLOUD}
      references={options.references}
    />,
  )
}

function faq(over: Partial<Faq> = {}): Faq {
  return {
    id: '00000000-0000-4000-8000-00000000f001',
    question: 'A question?',
    answer: 'An answer.',
    category: null,
    position: 1,
    status: 'PUBLISHED',
    fact_classification: 'GENERIC_SAFE',
    owner_verification: 'NOT_REQUIRED',
    ...over,
  } as Faq
}

describe('every block in the catalogue is built', () => {
  it('leaves no null renderer behind', () => {
    const unbuilt = BLOCK_TYPES.filter((type) => SECTION_RENDERERS[type] === null)
    expect(unbuilt).toEqual([])
  })
})

describe('rich-text', () => {
  const base = { block_type: 'rich-text' as const }

  it('splits the body on blank lines, so a clause is its own paragraph', () => {
    const { container } = renderSection(
      section({ ...base, heading: 'Data we hold', body: 'First clause.\n\nSecond clause.' }),
    )
    const paragraphs = [...container.querySelectorAll('p')].map((p) => p.textContent)
    expect(paragraphs).toContain('First clause.')
    expect(paragraphs).toContain('Second clause.')
  })

  it('renders nothing at all when no copy is written', () => {
    const { container } = renderSection(section(base))
    expect(container.querySelector('section')).toBeNull()
  })

  /** An unknown value from the database must fall through, as `schemeOf` does for an unknown theme. */
  it('falls through to prose on a layout_variant nobody implemented', () => {
    renderSection(section({ ...base, heading: 'Terms', layout_variant: 'nonsense' }))
    expect(screen.getByRole('heading', { name: 'Terms' })).toBeTruthy()
  })
})

describe('quote', () => {
  const base = { block_type: 'quote' as const }

  it('renders a blockquote, so the words are marked as somebody else’s', () => {
    const { container } = renderSection(
      section({ ...base, payload: { quote: 'It arrived as promised.' } }),
    )
    const quote = container.querySelector('blockquote')
    expect(quote?.textContent).toBe('It arrived as promised.')
  })

  it('carries cite as an attribute and never as a link', () => {
    const { container } = renderSection(
      section({
        ...base,
        payload: { quote: 'A line.', cite: 'https://example.test/review' },
      }),
    )
    expect(container.querySelector('blockquote')?.getAttribute('cite')).toBe(
      'https://example.test/review',
    )
    expect(container.querySelector('a[href="https://example.test/review"]')).toBeNull()
  })

  it('renders an unattributed quotation, which is the case that needs nobody’s confirmation', () => {
    const { container } = renderSection(section({ ...base, payload: { quote: 'A line.' } }))
    expect(container.querySelector('blockquote')).toBeTruthy()
    expect(container.querySelector('cite')).toBeNull()
  })

  it('never attributes silence: no quotation, no band', () => {
    const { container } = renderSection(
      section({ ...base, payload: { quote: '   ', attribution: 'A Name' } }),
    )
    expect(container.querySelector('section')).toBeNull()
    expect(container.textContent).not.toContain('A Name')
  })
})

describe('checklist', () => {
  const base = { block_type: 'checklist' as const, heading: 'What is included' }

  it('removes a withheld point entirely — no gap, no marker, no clue', () => {
    const { container } = renderSection(
      section({
        ...base,
        payload: {
          items: [
            { key: 'a', text: 'Confirmed point' },
            {
              key: 'b',
              text: 'Unconfirmed point',
              owner_verification: 'OWNER_VERIFICATION_REQUIRED',
            },
          ],
        },
      }),
    )
    expect(container.textContent).toContain('Confirmed point')
    expect(container.textContent).not.toContain('Unconfirmed point')
    expect(container.querySelectorAll('li')).toHaveLength(1)
  })

  it('hides the tick from assistive technology — the list already says it is a list', () => {
    const { container } = renderSection(
      section({ ...base, payload: { items: [{ key: 'a', text: 'A point' }] } }),
    )
    const svg = container.querySelector('li svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps the heading when every point is withheld', () => {
    const { container } = renderSection(
      section({
        ...base,
        payload: {
          items: [{ key: 'a', text: 'A point', owner_verification: 'OWNER_VERIFICATION_REQUIRED' }],
        },
      }),
    )
    expect(screen.getByRole('heading', { name: 'What is included' })).toBeTruthy()
    expect(container.querySelectorAll('li')).toHaveLength(0)
  })
})

describe('numbered-steps', () => {
  const base = { block_type: 'numbered-steps' as const, heading: 'How it works' }

  /**
   * THE ORDER OF TWO OPERATIONS IS THE WHOLE TEST. Numbering first and hiding second leaves 01, 03
   * — which tells a visitor something is missing and invites them to wonder what.
   */
  it('renumbers what survives, so a withheld step leaves no hole in the sequence', () => {
    const { container } = renderSection(
      section({
        ...base,
        payload: {
          steps: [
            { key: 'a', title: 'First', body: '' },
            {
              key: 'b',
              title: 'Hidden',
              body: '',
              owner_verification: 'OWNER_VERIFICATION_REQUIRED',
            },
            { key: 'c', title: 'Third', body: '' },
          ],
        },
      }),
    )
    expect(container.textContent).not.toContain('Hidden')
    const items = [...container.querySelectorAll('ol > li')]
    expect(items).toHaveLength(2)
    expect(items[0]?.textContent).toContain('01')
    expect(items[1]?.textContent).toContain('02')
    expect(items[1]?.textContent).toContain('Third')
  })

  it('is an ordered list, because the order is the content', () => {
    const { container } = renderSection(
      section({ ...base, payload: { steps: [{ key: 'a', title: 'First', body: '' }] } }),
    )
    expect(container.querySelector('ol')).toBeTruthy()
    expect(container.querySelector('ul')).toBeNull()
  })
})

describe('media-split', () => {
  const base = { block_type: 'media-split' as const }

  it('puts the copy first in the DOM whichever side the picture is on', () => {
    for (const variant of ['image-right', 'image-left']) {
      const { container, unmount } = renderSection(
        section({ ...base, heading: 'A heading', layout_variant: variant }),
      )
      const grid = container.querySelector('section div.grid')
      expect(grid?.firstElementChild?.textContent).toContain('A heading')
      unmount()
    }
  })

  it('renders with no asset — the reserved box is the layout, and absent copy is not', () => {
    const withCopy = renderSection(section({ ...base, heading: 'A heading' }))
    expect(withCopy.container.querySelector('section')).toBeTruthy()
    withCopy.unmount()

    const withoutCopy = renderSection(section(base))
    expect(withoutCopy.container.querySelector('section')).toBeNull()
  })
})

describe('contact-details', () => {
  const base = {
    block_type: 'contact-details' as const,
    heading: 'Reach the studio',
  }
  const payload = {
    phone: '+91 70960 36250',
    email: 'studio@example.test',
    whatsapp: '+917096036250',
  }

  it('strips spaces from the tel: href and keeps them in the visible text', () => {
    renderSection(section({ ...base, payload }))
    const link = screen.getByRole('link', { name: '+91 70960 36250' })
    expect(link.getAttribute('href')).toBe('tel:+917096036250')
  })

  it('links the address with mailto:', () => {
    renderSection(section({ ...base, payload }))
    expect(screen.getByRole('link', { name: 'studio@example.test' }).getAttribute('href')).toBe(
      'mailto:studio@example.test',
    )
  })

  /** A link with no label is an anonymous destination; one with no greeting opens a chat nobody wrote. */
  it('renders no WhatsApp link when either string is missing', () => {
    renderSection(section({ ...base, payload }), { strings: STRINGS_WITHOUT_WHATSAPP })
    expect(screen.queryByRole('link', { name: 'Discuss on WhatsApp' })).toBeNull()
  })

  it('renders the heading and no channels when the payload does not parse', () => {
    const { container } = renderSection(section({ ...base, payload: { phone: 42 } }))
    expect(screen.getByRole('heading', { name: 'Reach the studio' })).toBeTruthy()
    expect(container.querySelectorAll('a')).toHaveLength(0)
  })

  it('renders a location only when both the link and its label exist', () => {
    const { container } = renderSection(
      section({ ...base, payload: { ...payload, location_label: 'The studio' } }),
    )
    expect(container.textContent).not.toContain('The studio')
  })
})

describe('faq-list', () => {
  const base = { block_type: 'faq-list' as const, heading: 'Questions' }

  function withFaqs(rows: readonly Faq[]): PageReferences {
    return new Map([
      [SECTION_ID, { result: { cards: [], reason: 'OK' }, assets: new Map(), faqs: rows }],
    ])
  }

  it('renders each row as a details/summary pair, so it works with no JavaScript', () => {
    const { container } = renderSection(section(base), {
      references: withFaqs([faq({ id: 'f1', question: 'Do you ship?', answer: 'Yes.' })]),
    })
    const details = container.querySelector('details')
    expect(details).toBeTruthy()
    expect(within(details as HTMLElement).getByText('Do you ship?')).toBeTruthy()
  })

  it('opens the first row, so a page of closed rows does not read as an empty page', () => {
    const { container } = renderSection(section(base), {
      references: withFaqs([
        faq({ id: 'f1', question: 'First?' }),
        faq({ id: 'f2', question: 'Second?' }),
      ]),
    })
    const rows = [...container.querySelectorAll('details')]
    expect(rows[0]?.hasAttribute('open')).toBe(true)
    expect(rows[1]?.hasAttribute('open')).toBe(false)
  })

  it('groups under the row’s own category, never a label written in code', () => {
    const { container } = renderSection(section({ ...base, layout_variant: 'by-category' }), {
      references: withFaqs([
        faq({ id: 'f1', question: 'A?', category: 'Ordering' }),
        faq({ id: 'f2', question: 'B?', category: 'Care' }),
      ]),
    })
    const headings = [...container.querySelectorAll('h3')].map((h) => h.textContent)
    expect(headings).toEqual(['Ordering', 'Care'])
  })

  it('puts the uncategorised rows last and gives them no invented heading', () => {
    const { container } = renderSection(section({ ...base, layout_variant: 'by-category' }), {
      references: withFaqs([
        faq({ id: 'f1', question: 'Loose?', category: null }),
        faq({ id: 'f2', question: 'Grouped?', category: 'Ordering' }),
      ]),
    })
    const headings = [...container.querySelectorAll('h3')].map((h) => h.textContent)
    expect(headings).toEqual(['Ordering'])
    const questions = [...container.querySelectorAll('summary')].map((s) => s.textContent?.trim())
    expect(questions?.[questions.length - 1]).toContain('Loose?')
  })

  /** Every seeded answer is DRAFT until the owner verifies it, so this is the launch state. */
  it('keeps the heading when the published set is empty', () => {
    const { container } = renderSection(section(base), { references: withFaqs([]) })
    expect(screen.getByRole('heading', { name: 'Questions' })).toBeTruthy()
    expect(container.querySelector('details')).toBeNull()
  })

  it('renders nothing at all with neither copy nor rows', () => {
    const { container } = renderSection(section({ block_type: 'faq-list' }), {
      references: withFaqs([]),
    })
    expect(container.querySelector('section')).toBeNull()
  })
})
