import type { Route } from 'next'
import Link from 'next/link'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t, type StudioStringKey } from '@/components/studio/strings'
import { roleHasPermission, type Role } from '@/lib/auth/permissions'
import { STUDIO_NAV, type StudioNavLeaf } from '@/lib/auth/studio-nav'

/**
 * The research group's fifteen screens, grouped by what you are doing with them.
 *
 * §9's Phase E line: "Dashboard groups leaves: Setup (sources, scrape, jobs) / Queue (runs,
 * changes, explorer) / Analysis (large-format, compare, similarity, opportunities). **Do not hide
 * leaves — group them.**"
 *
 * IT LIVES ON THE DASHBOARD, NOT IN THE SIDEBAR, AND THAT IS THE READING THAT COSTS NOTHING. The
 * instruction says "Dashboard groups leaves". Restructuring the sidebar would mean adding a field
 * to `StudioNavLeaf` and changing the manifest that `studio-nav.test.ts` holds to disk — a change
 * to the shape of navigation for every group, to solve a problem one group has. Here it is a page
 * that reads the manifest and arranges what it finds.
 *
 * EVERY HREF COMES FROM `STUDIO_NAV`, WHICH IS THE BANS LIST'S RULE: "No hardcoded sidebar hrefs
 * outside the manifest." What is hardcoded below is the GROUPING — which of the three headings a
 * screen belongs under — and that is an editorial judgement about the work, not a route. A leaf
 * added to the manifest later appears without this file being touched, in the fourth group, which
 * is the failure mode worth having: it shows up in the wrong place rather than vanishing.
 *
 * THE GUIDE NAMES TEN OF THE FIFTEEN, AND THE OTHER FIVE ARE NOT DROPPED. Opportunity direction,
 * the shortlist, confirmed products and the sheets export are real screens somebody uses; the
 * dashboard is this page. "Do not hide leaves" is the sentence immediately after the grouping, so
 * the remainder gather under a fourth heading rather than disappearing to make a tidy three.
 *
 * PERMISSION-FILTERED, LIKE THE SIDEBAR. A leaf a role cannot open is not listed — and that is not
 * where the security is: every one of these routes calls `requirePermission` for itself. This is
 * the same distinction `lib/auth/studio-nav.ts` draws for the sidebar, and it holds here.
 */

/** The dashboard itself. Listing "you are here" as a destination is furniture. */
const SELF = '/studio/research/dashboard'

const GROUPS: readonly { readonly labelKey: StudioStringKey; readonly hrefs: readonly string[] }[] =
  [
    {
      labelKey: 'studio.research.groupSetup',
      hrefs: ['/studio/research/sources', '/studio/research/scrape', '/studio/research/jobs'],
    },
    {
      labelKey: 'studio.research.groupQueue',
      hrefs: ['/studio/research/runs', '/studio/research/changes', '/studio/research/explorer'],
    },
    {
      labelKey: 'studio.research.groupAnalysis',
      hrefs: [
        '/studio/research/large-format',
        '/studio/research/compare',
        '/studio/research/similarity',
        '/studio/research/opportunities',
        '/studio/research/opportunities/direction',
      ],
    },
  ]

export function LeafIndex({ role }: { readonly role: Role }) {
  const leaves = (STUDIO_NAV.find((group) => group.id === 'research')?.leaves ?? []).filter(
    (leaf) => leaf.href !== SELF && roleHasPermission(role, leaf.permission),
  )

  const named = new Set(GROUPS.flatMap((group) => group.hrefs))
  const sections = [
    ...GROUPS.map((group) => ({
      labelKey: group.labelKey,
      // Ordered by the GROUP's list, not the manifest's, so "sources, scrape, jobs" reads in the
      // sequence somebody actually performs them.
      leaves: group.hrefs.flatMap((href) => leaves.filter((leaf) => leaf.href === href)),
    })),
    {
      labelKey: 'studio.research.groupDecisions' as StudioStringKey,
      leaves: leaves.filter((leaf) => !named.has(leaf.href)),
    },
  ].filter((section) => section.leaves.length > 0)

  if (sections.length === 0) return null

  return (
    <Surface level={1} className="p-6" data-research-leaf-index="">
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={2} size="display-xs">
            {t('studio.research.leafIndexHeading')}
          </Heading>
          <Text tone="secondary" className="max-w-prose">
            {t('studio.research.leafIndexBody')}
          </Text>
        </Stack>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((section) => (
            <Stack key={section.labelKey} gap={1} data-research-group={section.labelKey}>
              <Text size="2xs" uppercase tone="tertiary">
                {t(section.labelKey)}
              </Text>
              <ul className="m-0 flex list-none flex-col p-0">
                {section.leaves.map((leaf) => (
                  <li key={leaf.href}>
                    <LeafLink leaf={leaf} />
                  </li>
                ))}
              </ul>
            </Stack>
          ))}
        </div>
      </Stack>
    </Surface>
  )
}

/**
 * `min-h-11` rather than the `rv-hit-44` overlay: these stack flush inside a column, so an overlay
 * on a short row would reach into its neighbours and steal their taps. The row is the target.
 */
function LeafLink({ leaf }: { readonly leaf: StudioNavLeaf }) {
  return (
    <Link href={leaf.href as Route} className="flex min-h-11 items-center rounded-sm px-1">
      <Text as="span" size="sm">
        {t(leaf.labelKey)}
      </Text>
    </Link>
  )
}
