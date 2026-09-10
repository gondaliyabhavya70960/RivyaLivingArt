'use client'

import * as React from 'react'

import { DimensionOverlay } from './DimensionOverlay'
import { LoadingProgress } from './LoadingProgress'
import { ENVIRONMENT_PRESETS, LIGHTING_PRESETS } from './presets'
import type { ModelViewerProps } from './types'
import { VariantSwitcher } from './VariantSwitcher'
import { ViewerCanvas, type ViewerCanvasHandle } from './ViewerCanvas'
import { ViewerControls } from './ViewerControls'
import { FocusTrap } from '@/components/primitives/FocusTrap'
import {
  type EnvironmentPresetKey,
  type LightingPresetKey,
  fallbackVariantLabel,
  resolveViewerSettings,
} from '@/lib/media/viewer-settings'
import { cn } from '@/lib/ui/cn'

/**
 * The viewer (registry RC-401). The only module a mount point imports dynamically, and the only
 * one — through `ViewerCanvas` — that reaches `@react-three/fiber`.
 *
 * ONE KEYBOARD MAP, OWNED HERE. The FEAT §12 table gives every control a pointer route and a
 * keyboard route; the pointer routes belong to `OrbitControls` and the buttons, the keyboard
 * routes are this file's `onStageKeyDown` (camera keys, on the canvas) and `onRootKeyDown`
 * (mode keys, anywhere in the viewer). Letter keys are ignored while a select or an input has
 * focus, so `D` typed into the lighting select still reaches the select.
 *
 * FULLSCREEN IS A FIXED SURFACE, NOT THE FULLSCREEN API. It behaves identically in every browser
 * the site supports, it is testable in a headless run, and `FocusTrap` holds focus inside it
 * exactly as a dialog would. `Escape` leaves fullscreen; below 768px, where the viewer opens
 * fullscreen by default, `Escape` closes the viewer outright and returns to the poster.
 *
 * UNDER REDUCED MOTION: no auto-rotate, no damping, no intro. The island reads the preference and
 * passes it down so this file cannot forget to; `ViewerCanvas` applies it to the controls.
 */

const ORBIT_STEP = (5 * Math.PI) / 180
const PAN_STEP = 0.08
const ZOOM_IN = 0.85
const ZOOM_OUT = 1 / ZOOM_IN

function isTextTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLSelectElement ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  )
}

export function ModelViewer(props: ModelViewerProps): React.ReactElement {
  const { copy, onClose, onError, reducedMotion, fullscreenByDefault } = props
  const resolved = React.useMemo(() => resolveViewerSettings(props.settings), [props.settings])

  const [lighting, setLighting] = React.useState<LightingPresetKey>(resolved.lightingPreset)
  const [environment, setEnvironment] = React.useState<EnvironmentPresetKey>(
    resolved.environmentPreset,
  )
  const [fileVariants, setFileVariants] = React.useState<readonly string[]>([])
  const [variant, setVariant] = React.useState<string | null>(null)
  const [inspecting, setInspecting] = React.useState(false)
  const [showDimensions, setShowDimensions] = React.useState(false)
  const [fullscreen, setFullscreen] = React.useState(fullscreenByDefault)
  const [ready, setReady] = React.useState(false)

  const canvas = React.useRef<ViewerCanvasHandle>(null)
  const id = React.useId()
  const stageId = `${id}-stage`
  const descriptionId = `${id}-description`

  const hasDimensions = props.dimensions.length > 0

  // The switcher's options: the keys the FILE declares, in the order Studio positioned them and
  // then the file's own order, each with the Studio label or the key made readable.
  const options = React.useMemo(() => {
    const labelled = new Map(props.variants.map((label) => [label.variantKey, label]))
    return fileVariants
      .map((key, index) => ({
        key,
        label: labelled.get(key)?.label ?? fallbackVariantLabel(key),
        order: labelled.get(key)?.position ?? 1_000 + index,
      }))
      .sort((a, b) => a.order - b.order)
      .map(({ key, label }) => ({ key, label }))
  }, [fileVariants, props.variants])

  const activeMaterialName = React.useMemo(() => {
    if (variant === null) return null
    const materialId = props.variants.find((label) => label.variantKey === variant)?.materialId
    return materialId === undefined || materialId === null
      ? null
      : (props.materialNames[materialId] ?? null)
  }, [variant, props.variants, props.materialNames])

  const onReady = React.useCallback((names: readonly string[]) => {
    setFileVariants(names)
    setVariant(names[0] ?? null)
    setReady(true)
  }, [])

  // The page behind a fullscreen viewer must not scroll under it.
  React.useEffect(() => {
    if (!fullscreen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [fullscreen])

  const toggleInspect = (): void => {
    setInspecting((current) => {
      canvas.current?.inspect(!current)
      return !current
    })
  }

  const leaveFullscreen = (): void => {
    if (fullscreenByDefault) onClose()
    else setFullscreen(false)
  }

  const onStageKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const api = canvas.current
    if (api === null) return
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        if (event.shiftKey) api.pan(-PAN_STEP, 0)
        else api.orbit(ORBIT_STEP, 0)
        return
      case 'ArrowRight':
        event.preventDefault()
        if (event.shiftKey) api.pan(PAN_STEP, 0)
        else api.orbit(-ORBIT_STEP, 0)
        return
      case 'ArrowUp':
        event.preventDefault()
        if (event.shiftKey) api.pan(0, PAN_STEP)
        else api.orbit(0, -ORBIT_STEP)
        return
      case 'ArrowDown':
        event.preventDefault()
        if (event.shiftKey) api.pan(0, -PAN_STEP)
        else api.orbit(0, ORBIT_STEP)
        return
      case '+':
      case '=':
        event.preventDefault()
        api.zoom(ZOOM_IN)
        return
      case '-':
      case '_':
        event.preventDefault()
        api.zoom(ZOOM_OUT)
        return
      default:
        return
    }
  }

  const onRootKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.defaultPrevented) return
    if (event.key === 'Escape') {
      if (!fullscreen) return
      event.preventDefault()
      event.stopPropagation()
      leaveFullscreen()
      return
    }
    if (isTextTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) return
    switch (event.key.toLowerCase()) {
      case 'r':
        event.preventDefault()
        canvas.current?.reset()
        return
      case 'f':
        event.preventDefault()
        if (fullscreen) leaveFullscreen()
        else setFullscreen(true)
        return
      case 'm':
        event.preventDefault()
        toggleInspect()
        return
      case 'd':
        if (!hasDimensions) return
        event.preventDefault()
        setShowDimensions((current) => !current)
        return
      default:
        return
    }
  }

  return (
    <FocusTrap
      active={fullscreen}
      data-model-viewer=""
      data-fullscreen={fullscreen ? '' : undefined}
      data-ready={ready ? '' : undefined}
      data-variant={variant ?? undefined}
      onKeyDown={onRootKeyDown}
      className={cn(
        'rv-scheme-ink flex flex-col bg-(--rv-3d-surface-solid) text-(--rv-3d-ink)',
        fullscreen
          ? 'fixed inset-0 z-(--rv-z-lightbox)'
          : 'relative aspect-4/3 w-full overflow-hidden rounded-sm',
      )}
    >
      <div id={stageId} className="relative min-h-0 flex-1">
        <ViewerCanvas
          ref={canvas}
          modelUrl={props.modelUrl}
          settings={resolved}
          lighting={LIGHTING_PRESETS[lighting]}
          environment={ENVIRONMENT_PRESETS[environment]}
          variantKey={variant}
          reducedMotion={reducedMotion}
          ariaLabel={copy.viewerName}
          ariaDescribedBy={descriptionId}
          onReady={onReady}
          onError={onError}
          onKeyDown={onStageKeyDown}
        />
        {ready ? null : <LoadingProgress template={copy.loading} />}
        {props.isConcept && copy.conceptNotice !== null ? (
          <p
            data-viewer-concept=""
            className="absolute top-4 left-4 max-w-72 rounded-sm bg-(--rv-3d-surface) px-3 py-1 text-xs text-(--rv-3d-ink)"
          >
            {copy.conceptNotice}
          </p>
        ) : null}
        {showDimensions && hasDimensions ? (
          <DimensionOverlay
            dimensions={props.dimensions}
            heading={copy.dimensionsHeading}
            labels={copy.dimensionLabels}
          />
        ) : null}
        {inspecting ? (
          <section
            data-viewer-material-panel=""
            aria-label={copy.materialHeading}
            className="absolute bottom-4 left-4 max-w-72 rounded-sm bg-(--rv-3d-surface) p-3 text-(--rv-3d-ink)"
          >
            <h3 className="mb-1 text-xs tracking-wide uppercase text-(--rv-3d-ink-muted)">
              {copy.materialHeading}
            </h3>
            <p className="text-sm" data-viewer-material-label="">
              {options.find((option) => option.key === variant)?.label ?? null}
            </p>
            {activeMaterialName === null ? null : (
              <p className="text-sm text-(--rv-3d-ink-muted)" data-viewer-material-name="">
                {activeMaterialName}
              </p>
            )}
          </section>
        ) : null}
      </div>

      <p id={descriptionId} className="sr-only">
        {copy.viewerDescription}
      </p>

      <div className="flex flex-col gap-3 border-t border-(--rv-3d-line) p-3">
        <VariantSwitcher
          options={options}
          active={variant}
          onChange={setVariant}
          label={copy.variants}
          controls={stageId}
        />
        <ViewerControls
          copy={copy}
          ids={{ lighting: `${id}-lighting`, environment: `${id}-environment` }}
          fullscreen={fullscreen}
          onToggleFullscreen={() => {
            if (fullscreen) leaveFullscreen()
            else setFullscreen(true)
          }}
          onReset={() => canvas.current?.reset()}
          onClose={onClose}
          inspecting={inspecting}
          onToggleInspect={toggleInspect}
          dimensionsAvailable={hasDimensions}
          dimensionsShown={showDimensions}
          onToggleDimensions={() => {
            setShowDimensions((current) => !current)
          }}
          lighting={lighting}
          onLighting={setLighting}
          environment={environment}
          onEnvironment={setEnvironment}
        />
      </div>
    </FocusTrap>
  )
}
