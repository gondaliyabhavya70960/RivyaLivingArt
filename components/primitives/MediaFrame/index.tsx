import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { AspectBox, type AspectBoxProps } from '@/components/primitives/AspectBox'

/**
 * MediaFrame is the box every image, video and 3D poster in the product sits in
 * (DESIGN_SYSTEM §10.1, registry RC-030). It is AspectBox plus the three things a frame
 * around real media always needs: the well behind it, the veil over it, and the answer
 * when there is nothing to show.
 *
 * IT EMITS NO MEDIA. §10.1 makes `MediaImage` and `MediaVideo` the only components
 * permitted to emit an `<img>` or a `<video>`, and Phase 06 builds them with the
 * `MediaProvider`, the `sizes` contract and the Cloudinary delivery rules. The media
 * arrives here as children, already resolved by `MediaSlot`. Nothing in this file knows a
 * URL, a transform or a breakpoint's worth of `srcset`, and nothing here should learn one.
 *
 * THE WELL. The frame paints `--rv-surface-sunken`, whose §2.5 role is exactly this —
 * "wells, code, table header, empty media". It is what shows through while a still is
 * decoding and what letterboxes an asset whose intrinsic ratio does not match the CMS
 * ratio, so a slow image is a dark plate rather than a hole in the section.
 *
 * THE FALLBACK (SEED §47). When no media resolves, the frame does not collapse and does
 * not borrow a sibling's image: the reserved box stays exactly the size AspectBox reserved
 * and the well carries a label. The label is a required prop and never a literal — SEED §1
 * and D2 put every visitor-readable string in the database, and this one is
 * `error.media_unavailable.label` in `global_content`. Requiring it even on frames that
 * expect to have media is deliberate: a frame that cannot say what happened is a frame
 * that will collapse when something does.
 *
 * The label is `--rv-ink-secondary`, not the `--rv-ink-tertiary` a caption would use, and
 * that choice is measured rather than aesthetic. §2.5 warns that INK's sunken surface is
 * the one place pure black is permitted and is "never a text ground"; secondary ink is the
 * strongest supporting ink in the system and clears AA on every scheme's well by a wide
 * margin — 10.42:1 on DEEP's obsidian well and 9.88:1 on BONE's bone-well, both from
 * §2.6/§2.7, and higher still on INK's black. A failure message is read, not skimmed.
 *
 * THE VEIL. `--rv-media-veil` is the §2.5 gradient that makes overlay ink survive whatever
 * photograph is underneath it — bottom-weighted, transparent by 78% of the height, so a
 * caption or an eyebrow at the foot of a hero keeps its contrast ratio without dimming the
 * whole image. It is opt-in (`veil`) because a frame with nothing over it does not need
 * it, and it is `aria-hidden` and `pointer-events-none` because it is a paint layer, not
 * content. There is no bridged utility for the gradient, so it is read from the token
 * directly in `style`, exactly as Container reads `--rv-gutter` (§5.3).
 *
 * STACKING WITHOUT A Z-INDEX. Media, then veil, then overlay, in DOM order. Positioned
 * elements paint above in-flow ones and later siblings above earlier ones, so the three
 * layers stack correctly with no `z-index` at all — which is right, because §5.6's scale
 * is for whole layers of the interface and a frame is not one of them.
 *
 * Media is square-cornered: `--rv-radius-0` per §6.1, on every image in every card and
 * gallery. "A rounded photograph of a resin table reads as a web widget."
 */
export interface MediaFrameProps extends AspectBoxProps {
  /**
   * The SEED §47 message shown on the well when no media resolves. From `global_content`
   * (`error.media_unavailable.label`), never a string written in a component.
   */
  fallbackLabel: string
  /** Paints `--rv-media-veil` over the media. Set it whenever text sits on the frame. */
  veil?: boolean
  /** Content that sits above the veil — a caption, an eyebrow, a play control. */
  overlay?: React.ReactNode
}

export const MediaFrame = React.forwardRef<HTMLElement, MediaFrameProps>(function MediaFrame(
  { fallbackLabel, veil = false, overlay, className, children, ...rest },
  ref,
) {
  // toArray drops null, undefined and booleans, so the ordinary `{asset && <MediaImage/>}`
  // and `{null}` shapes a resolver produces all read as "no media" rather than as a child.
  const hasMedia = React.Children.toArray(children).length > 0

  return (
    <AspectBox ref={ref} className={cn('bg-surface-sunken rounded-none', className)} {...rest}>
      {hasMedia ? (
        children
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
          <p className="text-ink-secondary text-sm">{fallbackLabel}</p>
        </div>
      )}

      {veil ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'var(--rv-media-veil)' }}
        />
      ) : null}

      {/* Anchored to the foot of the frame rather than stretched across it: the veil is
          bottom-weighted for exactly this content, and a full-bleed layer would swallow
          pointer events over media it does not cover. */}
      {overlay ? <div className="absolute inset-x-0 bottom-0">{overlay}</div> : null}
    </AspectBox>
  )
})
