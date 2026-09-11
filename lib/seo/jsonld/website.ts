import { present } from './guard'
import { organizationId } from './organization'

/**
 * `WebSite` — emitted from the root layout whenever there is an origin and a name, with the one
 * `potentialAction` the site genuinely offers: a `SearchAction` against `/search?q=`.
 *
 * `alternateName` ONLY WHEN THE OWNER SET ONE. An alternate name a builder made up would be a
 * second name for the business that nobody chose.
 */

export type WebSiteJsonLd = {
  readonly '@type': 'WebSite'
  readonly '@id': string
  readonly name: string
  readonly url: string
  readonly alternateName?: string
  readonly publisher?: { readonly '@id': string }
  readonly potentialAction?: {
    readonly '@type': 'SearchAction'
    readonly target: { readonly '@type': 'EntryPoint'; readonly urlTemplate: string }
    readonly 'query-input': string
  }
}

export type WebSiteInput = {
  readonly name: string | null
  readonly url: string | null
  readonly alternateName?: string | null
  /** The search route, site-relative. Absent means no `SearchAction`. */
  readonly searchPath?: string | null
  /** Whether an Organization node with the matching `@id` is in the same graph. */
  readonly hasOrganization?: boolean
}

export function webSiteJsonLd(input: WebSiteInput): WebSiteJsonLd | null {
  const name = present(input.name)
  const url = present(input.url)
  if (name === undefined || url === undefined) return null
  const alternateName = present(input.alternateName)
  const searchPath = present(input.searchPath)

  return {
    '@type': 'WebSite',
    '@id': `${url}/#website`,
    name,
    url,
    ...(alternateName === undefined ? {} : { alternateName }),
    ...(input.hasOrganization ? { publisher: { '@id': organizationId(url) } } : {}),
    ...(searchPath === undefined
      ? {}
      : {
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${url}${searchPath}?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
          },
        }),
  }
}
