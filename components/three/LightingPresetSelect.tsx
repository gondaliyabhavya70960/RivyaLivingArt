'use client'

import * as React from 'react'

import { Select } from '@/components/primitives/Select'
import { LIGHTING_PRESET_KEYS, type LightingPresetKey } from '@/lib/media/viewer-settings'

/** A native select: the keyboard model comes free and matches the FEAT §12 table. */
export function LightingPresetSelect({
  value,
  onChange,
  label,
  names,
  id,
}: {
  readonly value: LightingPresetKey
  readonly onChange: (key: LightingPresetKey) => void
  readonly label: string
  readonly names: Readonly<Record<LightingPresetKey, string>>
  readonly id: string
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-(--rv-3d-ink-muted)">
        {label}
      </label>
      <Select
        id={id}
        data-viewer-lighting=""
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.value as LightingPresetKey)
        }}
        className="min-h-(--rv-3d-control-size)"
      >
        {LIGHTING_PRESET_KEYS.map((key) => (
          <option key={key} value={key}>
            {names[key]}
          </option>
        ))}
      </Select>
    </div>
  )
}
