'use client'

import dynamic from 'next/dynamic'
import * as React from 'react'

import { useDeliveryConstraints } from '@/components/primitives/motion/useDeliveryConstraints'
import { useMinViewportWidth } from '@/components/primitives/motion/useMinViewportWidth'
import { useReducedMotion } from '@/components/primitives/motion/useReducedMotion'
import { PosterFallback } from '@/components/three/PosterFallback'
import type { ModelViewerCopy, ModelViewerData } from '@/components/three/types'
import { VIEWER_MIN_VIEWPORT, probeCapability } from '@/lib/media/model'

/**
 * The intent gate (registry RC-228, client half).
 *
 * THIS IS WHERE THE FEAT §14 BUDGET IS KEPT. `ModelViewer` is behind `next/dynamic` with
 * `ssr: false`, inside a Client Component as Next requires, and the import runs only when
 * `state` becomes `open` — on a press of the poster's control, or on intersection when the
 * capability probe allows auto-load. Until then the route bundle holds this file, the poster and
 * the probe, and not one byte of `three`.
 *
 * THE PROBE RUNS ON THE CLIENT AND RENDERS NOTHING UNTIL IT HAS. WebGL support cannot be known on
 * the server, so the first paint is the poster alone (which is what the LCP contract wants) and
 * the control appears once the browser has answered. A device the probe declines never sees the
 * control: a button that opens nothing is worse than none.
 */

const ModelViewer = dynamic(
  async () => (await import('@/components/three/ModelViewer')).ModelViewer,
  { ssr: false, loading: () => null },
)

type State = 'idle' | 'open' | 'failed'

let webglProbe: boolean | null = null

function probeWebgl(): boolean {
  if (webglProbe !== null) return webglProbe
  try {
    const canvas = document.createElement('canvas')
    webglProbe = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) !== null
  } catch {
    webglProbe = false
  }
  return webglProbe
}

const subscribeNever = (): (() => void) => () => {}

export function ModelViewerIsland({
  poster,
  data,
  copy,
}: {
  readonly poster: React.ReactNode
  readonly data: ModelViewerData
  readonly copy: ModelViewerCopy
}): React.ReactElement {
  const constraints = useDeliveryConstraints()
  const wide = useMinViewportWidth(VIEWER_MIN_VIEWPORT)
  const reducedMotion = useReducedMotion()
  // null on the server and during hydration; the client answers on its first render after.
  const webgl = React.useSyncExternalStore<boolean | null>(subscribeNever, probeWebgl, () => null)

  const capability = probeCapability({
    wideViewport: wide,
    reducedMotion,
    saveData: constraints.saveData,
    lowMemory: constraints.lowMemory,
    webgl: webgl === true,
  })

  const [state, setState] = React.useState<State>('idle')
  const root = React.useRef<HTMLDivElement>(null)

  // Auto-load on intersection, only where the probe allows it and only once.
  React.useEffect(() => {
    if (state !== 'idle' || !capability.autoLoad) return
    if (typeof IntersectionObserver === 'undefined') return
    const node = root.current
    if (node === null) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect()
          setState('open')
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [state, capability.autoLoad])

  const common = {
    ref: root,
    'data-model-island': '',
    'data-model-state': state,
    'data-model-capability':
      webgl === null ? 'probing' : capability.offered ? 'offered' : 'declined',
    'data-model-reasons': capability.reasons.join(' ') || undefined,
    'data-model-autoload': capability.autoLoad ? '' : undefined,
  }

  if (webgl === null || !capability.offered) {
    return (
      <div {...common}>
        <PosterFallback poster={poster} reason={null} action={null} />
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <div {...common}>
        <PosterFallback poster={poster} reason={copy.failed} action={null} />
      </div>
    )
  }

  if (state === 'idle') {
    return (
      <div {...common}>
        <PosterFallback
          poster={poster}
          reason={null}
          action={{
            label: copy.inspect,
            onClick: () => {
              setState('open')
            },
          }}
        />
      </div>
    )
  }

  return (
    <div {...common} className="relative">
      {/* The poster stays underneath until the canvas paints over it, so opening the viewer is
          never a flash of nothing. */}
      {poster}
      <div className="absolute inset-0">
        <ModelViewer
          {...data}
          copy={copy}
          reducedMotion={reducedMotion}
          fullscreenByDefault={capability.fullscreenByDefault}
          onClose={() => {
            setState('idle')
          }}
          onError={() => {
            setState('failed')
          }}
        />
      </div>
    </div>
  )
}
