import { present } from './guard'

/**
 * `BreadcrumbList` — the trail to a category, product, collection, project or article, derived
 * from REAL published parents and never from a parent invented to make the trail look complete.
 *
 * TWO POSITIONS OR NOTHING. A list of one item is the page pointing at itself, which tells a
 * crawler less than no list. The caller supplies the trail it can vouch for — the home page, the
 * listing the entity sits under, the entity — and any crumb without both a name and an absolute
 * URL is dropped rather than emitted half-formed. If dropping leaves fewer than two, the node is
 * not emitted.
 */

export type BreadcrumbJsonLd = {
  readonly '@type': 'BreadcrumbList'
  readonly itemListElement: readonly {
    readonly '@type': 'ListItem'
    readonly position: number
    readonly name: string
    readonly item: string
  }[]
}

export type Crumb = {
  readonly name: string | null | undefined
  readonly url: string | null | undefined
}

export function breadcrumbJsonLd(trail: readonly Crumb[]): BreadcrumbJsonLd | null {
  const items = trail
    .map((crumb) => ({ name: present(crumb.name), item: present(crumb.url) }))
    .filter(
      (crumb): crumb is { name: string; item: string } =>
        crumb.name !== undefined && crumb.item !== undefined,
    )
    .filter((crumb) => /^https?:\/\//.test(crumb.item))
  if (items.length < 2) return null
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.item,
    })),
  }
}
