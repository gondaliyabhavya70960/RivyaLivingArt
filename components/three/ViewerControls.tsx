'use client'

import * as React from 'react'

import { EnvironmentPresetSelect } from './EnvironmentPresetSelect'
import {
  CloseIcon,
  DimensionsIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  MaterialIcon,
  ResetIcon,
} from './icons'
import { LightingPresetSelect } from './LightingPresetSelect'
import type { ModelViewerCopy } from './types'
import { IconButton } from '@/components/primitives/IconButton'
import type { EnvironmentPresetKey, LightingPresetKey } from '@/lib/media/model'

/**
 * The bottom bar: 44px controls (DESIGN_SYSTEM §14) and the two native selects.
 *
 * PRESENTATIONAL. Every action is a callback; the viewer owns the state and the keyboard routes,
 * so a control here and a key on the canvas cannot disagree about what "reset" does. Toggles carry
 * `aria-pressed`; the dimensions toggle is absent, not disabled, when the product has none.
 */
export function ViewerControls({
  copy,
  ids,
  fullscreen,
  onToggleFullscreen,
  onReset,
  onClose,
  inspecting,
  onToggleInspect,
  dimensionsAvailable,
  dimensionsShown,
  onToggleDimensions,
  lighting,
  onLighting,
  environment,
  onEnvironment,
}: {
  readonly copy: ModelViewerCopy
  readonly ids: { readonly lighting: string; readonly environment: string }
  readonly fullscreen: boolean
  readonly onToggleFullscreen: () => void
  readonly onReset: () => void
  readonly onClose: () => void
  readonly inspecting: boolean
  readonly onToggleInspect: () => void
  readonly dimensionsAvailable: boolean
  readonly dimensionsShown: boolean
  readonly onToggleDimensions: () => void
  readonly lighting: LightingPresetKey
  readonly onLighting: (key: LightingPresetKey) => void
  readonly environment: EnvironmentPresetKey
  readonly onEnvironment: (key: EnvironmentPresetKey) => void
}): React.ReactElement {
  return (
    <div
      data-viewer-controls=""
      className="flex flex-wrap items-center justify-between gap-(--rv-3d-control-gap)"
    >
      <div className="flex flex-wrap items-center gap-(--rv-3d-control-gap)">
        <IconButton aria-label={copy.reset} onClick={onReset} data-viewer-reset="">
          <ResetIcon />
        </IconButton>
        <IconButton
          aria-label={copy.materialToggle}
          aria-pressed={inspecting}
          onClick={onToggleInspect}
          data-viewer-material=""
          variant={inspecting ? 'quiet' : 'ghost'}
        >
          <MaterialIcon />
        </IconButton>
        {dimensionsAvailable ? (
          <IconButton
            aria-label={copy.dimensionsToggle}
            aria-pressed={dimensionsShown}
            onClick={onToggleDimensions}
            data-viewer-dimensions-toggle=""
            variant={dimensionsShown ? 'quiet' : 'ghost'}
          >
            <DimensionsIcon />
          </IconButton>
        ) : null}
        <IconButton
          aria-label={fullscreen ? copy.exitFullscreen : copy.fullscreen}
          aria-pressed={fullscreen}
          onClick={onToggleFullscreen}
          data-viewer-fullscreen=""
        >
          {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
        </IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <LightingPresetSelect
          id={ids.lighting}
          value={lighting}
          onChange={onLighting}
          label={copy.lighting}
          names={copy.lightingPresets}
        />
        <EnvironmentPresetSelect
          id={ids.environment}
          value={environment}
          onChange={onEnvironment}
          label={copy.environment}
          names={copy.environmentPresets}
        />
        <IconButton aria-label={copy.close} onClick={onClose} data-viewer-close="">
          <CloseIcon />
        </IconButton>
      </div>
    </div>
  )
}
