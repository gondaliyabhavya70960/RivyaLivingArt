import type { SeedModule, SeedRecord } from './types'

/**
 * The header menu with its Collection children (SEED §8), the mobile menu, and the four footer
 * columns (§24).
 *
 * POSITIONS ARE SPACED BY TEN so the owner can insert an item between two existing ones without
 * renumbering the rest — the same reason `taxonomy.ts` spaces the categories.
 *
 * THE CATEGORY CHILDREN ARE IN D3's PRIORITY ORDER, not the specification's list order, and the
 * two differ. §8 lists them as Furniture, Collectible Design, 3D + Resin, Wall & Statement Art,
 * Preservation, Décor, Gifts — which is D3's order — and SEED §56 makes that order a decision
 * rather than a coincidence: it is the positioning, and it deliberately does not lead with the
 * families that happen to have the most assets. `collections.ts` encodes the same order and a
 * test asserts it, so the menu and the pages cannot drift apart.
 *
 * MOBILE MIRRORS THE HEADER, which §8 states as the default ("identical unless owner changes it").
 * They are separate rows rather than one menu rendered twice, because the moment the owner wants a
 * shorter mobile menu — which they will — the alternative is a code change.
 *
 * THE FOOTER'S CONTACT COLUMN IS A HEADING WITH NO LINKS. §24 says "Phone / WhatsApp / Email /
 * Location", and every one of those is a real business fact the seed does not have. Seeding
 * `+91 XXXXX` or a placeholder address would be exactly the fabrication D10 forbids, and an empty
 * column that says what belongs in it is more useful to the owner than an invented one. The
 * details themselves are seeded on the contact page as a section carrying
 * OWNER_VERIFICATION_REQUIRED, where the owner fills them in once.
 */

type NavOptions = {
  parent?: string
  visible?: boolean
  status?: string
  description?: string
}

function navRow(
  menu: string,
  key: string,
  label: string,
  href: string,
  position: number,
  options: NavOptions = {},
): SeedRecord {
  const record: SeedRecord = {
    seedKey: `nav:${menu.toLowerCase()}.${key}`,
    table: 'navigation_items',
    fields: {
      menu,
      label,
      href,
      position,
      is_visible: options.visible ?? true,
      target: '_self',
      status: options.status ?? 'PUBLISHED',
      fact_classification: 'BRAND_COPY',
      owner_verification: 'NOT_REQUIRED',
    },
  }
  if (options.parent === undefined) return record
  return {
    ...record,
    refs: { parent_id: { table: 'navigation_items', seedKey: options.parent } },
  }
}

/** SEED §8's nine top-level destinations, in its order. */
const TOP_LEVEL: readonly (readonly [string, string, string])[] = [
  ['home', 'Home', '/'],
  ['collection', 'Collection', '/collection'],
  ['large-format', 'Large Format', '/large-format'],
  ['custom-commissions', 'Custom Commissions', '/custom-commissions'],
  ['portfolio', 'Portfolio', '/portfolio'],
  ['process', 'Process', '/process'],
  ['about', 'About', '/about'],
  ['journal', 'Journal', '/journal'],
  ['contact', 'Contact', '/contact'],
]

/**
 * The seven categories under Collection, in D3 and SEED §56 priority order.
 *
 * The labels are §8's, including "Décor" with its acute accent and "3D + Resin" with its spaces
 * around the plus — an editor who retypes them without will produce a menu that reads subtly
 * wrong, so they are quoted rather than derived from the slugs.
 */
const CATEGORY_CHILDREN: readonly (readonly [string, string])[] = [
  ['furniture', 'Furniture'],
  ['collectible-design', 'Collectible Design'],
  ['3d-resin', '3D + Resin'],
  ['wall-statement-art', 'Wall & Statement Art'],
  ['preservation', 'Preservation'],
  ['decor', 'Décor'],
  ['gifts', 'Gifts'],
]

const FOOTER_COLUMNS: readonly (readonly [
  string,
  string,
  readonly (readonly [string, string, string])[],
])[] = [
  [
    'explore',
    'Explore',
    [
      ['collection', 'Collection', '/collection'],
      ['large-format', 'Large Format', '/large-format'],
      ['portfolio', 'Portfolio', '/portfolio'],
      ['journal', 'Journal', '/journal'],
    ],
  ],
  [
    'studio',
    'Studio',
    [
      ['about', 'About', '/about'],
      ['process', 'Process', '/process'],
      ['custom-commissions', 'Custom Commissions', '/custom-commissions'],
      ['contact', 'Contact', '/contact'],
    ],
  ],
  [
    'information',
    'Information',
    [
      ['faq', 'FAQ', '/faq'],
      ['privacy', 'Privacy', '/privacy'],
      ['terms', 'Terms', '/terms'],
    ],
  ],
]

function headerRows(menu: 'HEADER' | 'MOBILE'): SeedRecord[] {
  const rows: SeedRecord[] = TOP_LEVEL.map(([key, label, href], i) =>
    navRow(menu, key, label, href, (i + 1) * 10),
  )
  rows.push(
    ...CATEGORY_CHILDREN.map(([slug, label], i) =>
      navRow(menu, `collection.${slug}`, label, `/collection/${slug}`, (i + 1) * 10, {
        parent: `nav:${menu.toLowerCase()}.collection`,
      }),
    ),
  )
  return rows
}

export const navigationSeed: SeedModule = {
  name: 'navigation',
  description:
    'Header and mobile menus with their Collection children (§8), and four footer columns (§24).',
  records: [
    ...headerRows('HEADER'),
    ...headerRows('MOBILE'),

    // --- §24 footer -----------------------------------------------------------------------------
    ...FOOTER_COLUMNS.flatMap(([columnKey, columnLabel, links], columnIndex) => {
      /**
       * A column heading is a navigation item with no destination of its own. `href` is `not null`
       * on the table, so it carries `#` rather than an empty string: an empty href resolves to the
       * current page, which makes a heading look like a link that reloads. `#` is inert and is
       * what the renderer tests for to decide the row is a heading rather than a link.
       */
      const heading = navRow('FOOTER', columnKey, columnLabel, '#', (columnIndex + 1) * 10)
      return [
        heading,
        ...links.map(([key, label, href], i) =>
          navRow('FOOTER', `${columnKey}.${key}`, label, href, (i + 1) * 10, {
            parent: `nav:footer.${columnKey}`,
          }),
        ),
      ]
    }),

    /**
     * The fourth column. Heading only — see the header note: phone, WhatsApp, email and location
     * are real business facts the seed does not have, and inventing them is the failure D10 names
     * first. The owner fills them in on the contact page, where the section that holds them
     * carries OWNER_VERIFICATION_REQUIRED.
     */
    navRow('FOOTER', 'contact', 'Contact', '#', 40, {
      description: 'SEED §24 lists Phone / WhatsApp / Email / Location. None is seeded.',
    }),
  ],
}
