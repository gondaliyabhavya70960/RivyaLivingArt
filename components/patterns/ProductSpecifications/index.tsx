import * as React from 'react'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { dimensionEntries } from '@/lib/catalog/dimensions'
import { siteString, type SiteStrings } from '@/lib/cms/strings'
import type { ProductSpec } from '@/lib/supabase/schemas'

/**
 * The specification block — the strictest surface on this site.
 *
 * THERE IS NO PLACEHOLDER BRANCH IN THIS FILE, and that is the whole design. Not an em dash, not
 * "N/A", not "TBD", not "Contact us for dimensions". Each of those tells a visitor that a value
 * exists and is being withheld, which is a claim about the object nobody made. A value that is
 * absent produces NO ROW; a block with no rows is absent from the DOM entirely rather than rendered
 * empty with a heading over nothing.
 *
 * You cannot add a placeholder here by changing a prop, because there is no prop to change and no
 * fallback expression to edit. The only way a row appears is that a row exists.
 *
 * NOTHING IS COMPUTED, CONVERTED, INFERRED, ROUNDED OR DEFAULTED. A millimetre value entered by the
 * owner renders in millimetres. `dimensionEntries` carries the unit from the key rather than
 * choosing one, and `product_specs.unit` is whatever the owner typed. There is no arithmetic in
 * this component at all — no cm, no inches, no derived volume, no "approximately".
 *
 * TWO SOURCES, ONE TABLE. `product_specs` rows are free-form facts the owner typed; the non-null
 * keys of `products.dimensions` are the seven measurements the schema knows. They render together
 * because a visitor reading a specification table does not care which column of which table a
 * number came from, and they render in that order because the owner's own rows are the ones they
 * chose to write.
 *
 * THE ROWS ARE ALREADY FILTERED BY RLS. `product_specs_select_public` admits a row only when both
 * it and its parent product are PUBLISHED, so this component does not re-test `status` — doing so
 * would imply the policy is advisory. A staff preview legitimately sees drafts here, which is what
 * the Studio wants.
 */

export interface ProductSpecificationsProps {
  /** Published spec rows for this product, in the owner's order. */
  readonly specs: readonly ProductSpec[]
  /** `products.dimensions`, unparsed. Anything malformed contributes no rows. */
  readonly dimensions: unknown
  readonly strings: SiteStrings
  /** Heading level, so the block sits correctly under the page's `h1`. */
  readonly headingLevel?: 2 | 3
}

/** One rendered line. `unit` is null for a count and for a spec row the owner left unitless. */
type Row = {
  readonly key: string
  readonly label: string
  readonly value: string
  readonly unit: string | null
  readonly group: string | null
}

function specRows(specs: readonly ProductSpec[]): Row[] {
  return specs.map((spec) => ({
    key: `spec:${spec.id}`,
    label: spec.label,
    value: spec.value,
    unit: spec.unit,
    group: spec.group_label,
  }))
}

/**
 * A dimension contributes a row ONLY when the CMS names it.
 *
 * The label is a `global_content` row, like every other visitor-readable word on this site, so an
 * owner can call `length_mm` "Length" or "Table length" without a code change. When the row is
 * missing the measurement is DROPPED rather than labelled with its raw key — `length_mm` is an
 * internal identifier, and showing one to a visitor is worse than showing them one fewer fact.
 */
function dimensionRows(dimensions: unknown, strings: SiteStrings): Row[] {
  return dimensionEntries(dimensions).flatMap((entry) => {
    const label = siteString(strings, `SPEC_LABEL.dimension.${entry.key}`)
    if (label === null) return []
    return [
      {
        key: `dimension:${entry.key}`,
        label,
        value: String(entry.value),
        unit: entry.unit,
        group: null,
      },
    ]
  })
}

export function ProductSpecifications({
  specs,
  dimensions,
  strings,
  headingLevel = 2,
}: ProductSpecificationsProps): React.ReactElement | null {
  const rows = [...specRows(specs), ...dimensionRows(dimensions, strings)]
  // Absent, not empty. No heading over nothing, no zero-height container.
  if (rows.length === 0) return null

  const heading = siteString(strings, 'SPEC_LABEL.specifications.heading')

  // Grouping preserves first-appearance order rather than sorting: the owner's order is the order.
  const groups: { label: string | null; rows: Row[] }[] = []
  for (const row of rows) {
    const existing = groups.find((g) => g.label === row.group)
    if (existing) existing.rows.push(row)
    else groups.push({ label: row.group, rows: [row] })
  }

  return (
    <section data-product-specifications="">
      <Stack gap={6}>
        {heading === null ? null : <Heading level={headingLevel}>{heading}</Heading>}

        {groups.map((group) => (
          <Stack key={group.label ?? '—ungrouped'} gap={3}>
            {group.label === null ? null : (
              <Heading level={headingLevel === 2 ? 3 : 4}>{group.label}</Heading>
            )}
            <dl data-spec-list="">
              {group.rows.map((row) => (
                <div key={row.key} data-spec-row="">
                  <dt>
                    <Text as="span" size="sm" tone="secondary">
                      {row.label}
                    </Text>
                  </dt>
                  <dd>
                    <Text as="span">
                      {/* The unit is appended, never converted, and absent when there is none. */}
                      {row.unit === null ? row.value : `${row.value} ${row.unit}`}
                    </Text>
                  </dd>
                </div>
              ))}
            </dl>
          </Stack>
        ))}
      </Stack>
    </section>
  )
}
