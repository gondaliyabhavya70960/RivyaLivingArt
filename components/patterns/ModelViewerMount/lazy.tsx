import dynamic from 'next/dynamic'

/**
 * The mount, behind a second boundary.
 *
 * `ModelViewerMount` is a Server Component, but its island and its poster fallback are Client
 * Components, and a route that imports the mount statically ships their JavaScript to every
 * visitor whether or not a model exists — which today is never. `next/dynamic` here makes the
 * mount's client half a chunk that arrives only when a mount actually renders, so a homepage
 * whose `three-d-resin` band has no model, or a product page with no model, pays nothing for the
 * capability. `scripts/site/check-island-budget.mjs` sees the `import()` and counts the island as
 * on-demand rather than against the homepage's budget of five.
 *
 * The engine itself is a THIRD boundary, inside the island (`Island.tsx`); this one is about the
 * few kilobytes of gate, not the hundreds of the viewer.
 */
export const LazyModelViewerMount = dynamic(async () => (await import('./index')).ModelViewerMount)
