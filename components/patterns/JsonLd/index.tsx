import * as React from 'react'

import { serialiseJsonLd } from '@/lib/seo/jsonld'

/**
 * RC-347 `JsonLd` — the ONLY emitter of `<script type="application/ld+json">` on this site.
 *
 * ONE COMPONENT, ONE SCRIPT ELEMENT PER ROUTE. Every builder in `lib/seo/jsonld/` returns a node
 * or null; the route collects the survivors into one `@graph` and hands it here. Rendering nothing
 * for a null graph is the honest answer to "there is nothing true to say", and it is why a page
 * with an unverified brand row carries no structured data rather than a partial one.
 *
 * `dangerouslySetInnerHTML` IS REQUIRED HERE AND FORBIDDEN EVERYWHERE ELSE. React escapes text
 * children as HTML, which would turn every `"` in the JSON into `&quot;` and leave a crawler with
 * a script it cannot parse. `serialiseJsonLd` escapes the one sequence that matters inside a
 * script block — `<` — so an editor's `</script>` in a brand name cannot close the element.
 * `scripts/seo/check-jsonld-scope.mjs` fails the build on `ld+json` in any other file.
 *
 * A Server Component: no state, no effects, no client runtime.
 */
export function JsonLd({ graph }: { readonly graph: object | null }): React.ReactElement | null {
  if (graph === null) return null
  return (
    <script
      type="application/ld+json"
      data-jsonld=""
      dangerouslySetInnerHTML={{ __html: serialiseJsonLd(graph) }}
    />
  )
}
