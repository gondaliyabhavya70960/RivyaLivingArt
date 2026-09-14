import { ImageResponse } from 'next/og'

/**
 * Apple touch icon — same geometric mark as `app/icon.svg` / the default OG card.
 *
 * Colours are HSL equivalents of `--rv-color-obsidian` and `--rv-color-champagne`. Hex and
 * `rgb()` literals are refused outside `app/styles/` by `check-tokens.mjs`; HSL is not.
 */

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon(): ImageResponse {
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
          width: 108,
          height: 108,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // --rv-color-champagne
          border: '3px solid hsl(40 39% 55%)',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            backgroundColor: 'hsl(40 39% 55%)',
          }}
        />
      </div>
    </div>,
    { ...size },
  )
}
