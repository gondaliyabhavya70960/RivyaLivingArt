import { ImageResponse } from 'next/og'

/**
 * Default Open Graph / social card — a geometric brand mark, not a product photograph.
 *
 * Product routes that resolve an `ogMediaId` still win via `lib/seo/metadata.ts` (they set
 * `openGraph.images` / `twitter.images` from the Cloudinary `og` preset). This file is the
 * fallback for every other surface, so a share of `/` or `/about` no longer ships without a card.
 *
 * Colours are HSL equivalents of `--rv-color-obsidian` and `--rv-color-champagne`. Hex and
 * `rgb()` literals are refused outside `app/styles/` by `check-tokens.mjs`; HSL is not.
 */

export const alt = 'Rivya Living Art'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // --rv-color-obsidian
        backgroundColor: 'hsl(220 27% 5%)',
      }}
    >
      <div
        style={{
          width: 168,
          height: 168,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // --rv-color-champagne
          border: '2px solid hsl(40 39% 55%)',
        }}
      >
        <div
          style={{
            width: 76,
            height: 76,
            backgroundColor: 'hsl(40 39% 55%)',
          }}
        />
      </div>
    </div>,
    { ...size },
  )
}
