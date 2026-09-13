import { Text } from '@/components/primitives/Text'
import { siteString, type SiteStrings } from '@/lib/cms/strings'

/**
 * What a public media well draws when nothing is bound to it.
 *
 * "EMPTY IS DESIGNED" — public redesign guide §3. Before this, a well with no asset drew an empty
 * `<div>`: a black box on the homepage hero and, further down, a row of them. §5.4 asks for a bone
 * plate instead — a thin rule, "Photograph in preparation", and the object's own name where there
 * is one.
 *
 * IT IS NOT THE FAILURE COPY, AND THE DISTINCTION IS THE WHOLE POINT. `ERROR.media_unavailable.*`
 * means an image that EXISTS could not be shown. This means no photograph has been taken yet, which
 * on this site is the ordinary state of almost everything: the catalogue is concept media and
 * objects that have not been built. The site used to render the failure string here — five times
 * down the homepage — which told a visitor something was broken when nothing was. A52 removed the
 * string and left the well silent; this gives the silence something honest to say.
 *
 * IT PROMISES NO DATE. "In preparation" is true the moment an object is briefed. "Coming soon"
 * would be a delivery claim, and SEED §55 forbids one.
 *
 * THE COPY COMES FROM `global_content`, NOT FROM THIS FILE. `cms:check-copy` fails a public
 * renderer carrying a visitor-readable literal, and it is right to: the owner changes this sentence
 * in Studio, not in a pull request. When the row is missing or disabled `siteString` returns null
 * and the plate renders NOTHING — the well goes back to being a quiet box, which is the behaviour
 * this replaces rather than a regression.
 *
 * THE TITLE IS OPTIONAL AND IS NEVER INVENTED. A hero has no object name; a product well does.
 * Passing the slug, the filename or "Untitled" would be the interface making something up about a
 * piece nobody has photographed.
 */
export function EmptyPlate({
  strings,
  title,
}: {
  readonly strings: SiteStrings
  /** The object's own name, when the surface has one. Never a slug, never a placeholder. */
  readonly title?: string | null
}) {
  const label = siteString(strings, 'MEDIA.pending.label')
  if (label === null) return null

  return (
    <div className="flex max-w-(--rv-container-prose) flex-col items-center gap-3">
      {/*
       * The rule is the "bone plate" §5.4 asks for: it gives the empty box an edge to read as
       * deliberate rather than as a region that failed to paint. `border-line` is the hairline
       * token the rest of the site uses, so this adds no colour.
       */}
      <span aria-hidden="true" className="border-line block w-12 border-t" />
      <Text as="p" size="sm" tone="secondary">
        {label}
      </Text>
      {title === undefined || title === null || title === '' ? null : (
        <Text as="p" size="xs" tone="tertiary">
          {title}
        </Text>
      )}
    </div>
  )
}
