'use client'

import * as React from 'react'

import { Select } from '@/components/primitives/Select'
import { ENVIRONMENT_PRESET_KEYS, type EnvironmentPresetKey } from '@/lib/media/viewer-settings'

/** A native select, for the same reason as the lighting one. */
export function EnvironmentPresetSelect({
  value,
  onChange,
  label,
  names,
  id,
}: {
  readonly value: EnvironmentPresetKey
  readonly onChange: (key: EnvironmentPresetKey) => void
  readonly label: string
  readonly names: Readonly<Record<EnvironmentPresetKey, string>>
  readonly id: string
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-(--rv-3d-ink-muted)">
        {label}
      </label>
      <Select
        id={id}
        data-viewer-environment=""
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.value as EnvironmentPresetKey)
        }}
        className="min-h-(--rv-3d-control-size)"
      >
        {ENVIRONMENT_PRESET_KEYS.map((key) => (
          <option key={key} value={key}>
            {names[key]}
          </option>
        ))}
      </Select>
    </div>
  )
}
