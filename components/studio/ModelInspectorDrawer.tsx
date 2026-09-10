'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { useActionState } from 'react'

import { MediaPicker, type PickerAsset } from './MediaPicker'
import { megabytes } from './model-findings'
import { t } from './strings'
import type { ModelActionState } from '@/app/(studio)/studio/(shell)/media/models/actions'
import { Drawer } from '@/components/patterns/Drawer'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Checkbox } from '@/components/primitives/Checkbox'
import { ErrorText } from '@/components/primitives/ErrorText'
import { Field } from '@/components/primitives/Field'
import { Heading } from '@/components/primitives/Heading'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { useReducedMotion } from '@/components/primitives/motion/useReducedMotion'
import type { ModelViewerCopy } from '@/components/three/types'
import {
  ENVIRONMENT_PRESET_KEYS,
  LIGHTING_PRESET_KEYS,
  type EnvironmentPresetKey,
  type LightingPresetKey,
  type ViewerSettings,
  parseViewerSettings,
  publicVariantLabels,
} from '@/lib/media/model'
import type { MediaAsset, ModelVariantLabel } from '@/lib/supabase/schemas'

/**
 * `/studio/media/models` — the inspector drawer (Phase 21).
 *
 * FIVE FORMS, ONE ROW. Metadata (read-only, with a re-inspect), stills, viewer settings, finish
 * labels and association each post to their own Server Action, so a refused association does not
 * un-save a poster. Each form owns its own `useActionState`; the drawer holds the controlled values
 * the live preview needs and nothing else.
 *
 * THE METADATA BLOCK HAS NO INPUTS. Format, size, triangles and textures were read from the file
 * by the inspector, and a person typing a number over them would turn a measurement back into a
 * claim. "Re-inspect from the file" is the only way the block changes.
 *
 * THE PREVIEW IS THE REAL VIEWER, imported dynamically here as it is on the public site — not a
 * Studio approximation of it. Changing a setting reloads it with the new settings, which is what
 * "live preview" means when the thing being previewed is a WebGL scene with a fixed initial camera.
 */

const ModelViewer = dynamic(
  async () => (await import('@/components/three/ModelViewer')).ModelViewer,
  { ssr: false, loading: () => null },
)

export type ModelAction = (state: ModelActionState, form: FormData) => Promise<ModelActionState>

export type ModelDrawerProps = {
  readonly asset: MediaAsset
  readonly modelUrl: string | null
  readonly labels: readonly ModelVariantLabel[]
  readonly images: readonly PickerAsset[]
  readonly products: readonly { readonly id: string; readonly label: string }[]
  readonly projects: readonly { readonly id: string; readonly label: string }[]
  readonly materials: readonly { readonly id: string; readonly label: string }[]
  readonly canWrite: boolean
  readonly canVerify: boolean
  readonly canAssociateProduct: boolean
  readonly actions: {
    readonly reinspect: ModelAction
    readonly stills: ModelAction
    readonly settings: ModelAction
    readonly labels: ModelAction
    readonly associate: ModelAction
  }
}

const IDLE: ModelActionState = { status: 'idle' }

const VERIFICATIONS = ['NOT_REQUIRED', 'OWNER_VERIFICATION_REQUIRED', 'VERIFIED'] as const
type Verification = (typeof VERIFICATIONS)[number]

function Outcome({ state }: { state: ModelActionState }): React.ReactElement | null {
  if (state.status === 'saved') {
    return (
      <Text size="sm" tone="secondary" role="status">
        {state.message}
      </Text>
    )
  }
  if (state.status === 'error') {
    return (
      <Stack gap={1}>
        {state.issues.map((issue) => (
          <ErrorText key={`${issue.field}:${issue.message}`}>{issue.message}</ErrorText>
        ))}
      </Stack>
    )
  }
  return null
}

function previewCopy(title: string): ModelViewerCopy {
  return {
    inspect: t('studio.models.viewer.inspect'),
    viewerName: t('studio.models.viewer.name').replace('{{title}}', title),
    viewerDescription: t('studio.models.viewer.description'),
    loading: t('studio.models.viewer.loading'),
    failed: t('studio.models.viewer.failed'),
    reset: t('studio.models.viewer.reset'),
    fullscreen: t('studio.models.viewer.fullscreen'),
    exitFullscreen: t('studio.models.viewer.exitFullscreen'),
    close: t('studio.models.viewer.close'),
    materialToggle: t('studio.models.viewer.materialToggle'),
    materialHeading: t('studio.models.viewer.materialHeading'),
    variants: t('studio.models.viewer.variants'),
    dimensionsToggle: t('studio.models.viewer.dimensionsToggle'),
    dimensionsHeading: t('studio.models.viewer.dimensionsHeading'),
    lighting: t('studio.models.viewer.lighting'),
    environment: t('studio.models.viewer.environment'),
    lightingPresets: {
      'studio-soft': t('studio.models.viewer.lighting.studio-soft'),
      'gallery-directional': t('studio.models.viewer.lighting.gallery-directional'),
      'daylight-window': t('studio.models.viewer.lighting.daylight-window'),
      'low-key': t('studio.models.viewer.lighting.low-key'),
    },
    environmentPresets: {
      'neutral-room': t('studio.models.viewer.environment.neutral-room'),
      'dark-gallery': t('studio.models.viewer.environment.dark-gallery'),
      'warm-interior': t('studio.models.viewer.environment.warm-interior'),
    },
    dimensionLabels: {},
    conceptNotice: t('studio.models.viewer.conceptNotice'),
  }
}

// --- Settings form state -------------------------------------------------------------------------

type SettingsDraft = {
  exposure: string
  lightingPreset: LightingPresetKey | ''
  environmentPreset: EnvironmentPresetKey | ''
  autoRotate: boolean
  minDistance: string
  maxDistance: string
  position: [string, string, string]
  target: [string, string, string]
  fov: string
}

function draftFrom(settings: ViewerSettings): SettingsDraft {
  const vec = (v: readonly [number, number, number] | undefined): [string, string, string] =>
    v === undefined ? ['', '', ''] : [String(v[0]), String(v[1]), String(v[2])]
  return {
    exposure: settings.exposure === undefined ? '' : String(settings.exposure),
    lightingPreset: settings.lightingPreset ?? '',
    environmentPreset: settings.environmentPreset ?? '',
    autoRotate: settings.autoRotate ?? false,
    minDistance: settings.minDistance === undefined ? '' : String(settings.minDistance),
    maxDistance: settings.maxDistance === undefined ? '' : String(settings.maxDistance),
    position: vec(settings.camera?.position),
    target: vec(settings.camera?.target),
    fov: settings.camera?.fov === undefined ? '' : String(settings.camera.fov),
  }
}

function num(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : undefined
}

function vec3(values: [string, string, string]): [number, number, number] | undefined {
  const parsed = values.map(num)
  return parsed.every((v): v is number => v !== undefined) && parsed.length === 3
    ? [parsed[0] as number, parsed[1] as number, parsed[2] as number]
    : undefined
}

/** The draft as the JSON the action validates: empty fields are absent, not zero. */
function settingsFrom(draft: SettingsDraft): ViewerSettings {
  const camera: NonNullable<ViewerSettings['camera']> = {}
  const position = vec3(draft.position)
  const target = vec3(draft.target)
  const fov = num(draft.fov)
  if (position !== undefined) camera.position = position
  if (target !== undefined) camera.target = target
  if (fov !== undefined) camera.fov = fov

  const settings: ViewerSettings = {}
  if (Object.keys(camera).length > 0) settings.camera = camera
  const exposure = num(draft.exposure)
  if (exposure !== undefined) settings.exposure = exposure
  if (draft.lightingPreset !== '') settings.lightingPreset = draft.lightingPreset
  if (draft.environmentPreset !== '') settings.environmentPreset = draft.environmentPreset
  if (draft.autoRotate) settings.autoRotate = true
  const minDistance = num(draft.minDistance)
  if (minDistance !== undefined) settings.minDistance = minDistance
  const maxDistance = num(draft.maxDistance)
  if (maxDistance !== undefined) settings.maxDistance = maxDistance
  return settings
}

function Vec3Fields({
  idBase,
  label,
  value,
  onChange,
  disabled,
}: {
  idBase: string
  label: string
  value: [string, string, string]
  onChange: (next: [string, string, string]) => void
  disabled: boolean
}): React.ReactElement {
  return (
    <Field label={label} controlId={`${idBase}-x`}>
      <div className="grid grid-cols-3 gap-2">
        {(['x', 'y', 'z'] as const).map((axis, index) => (
          <Input
            key={axis}
            id={`${idBase}-${axis}`}
            aria-label={`${label} ${axis}`}
            inputMode="decimal"
            value={value[index]}
            disabled={disabled}
            onChange={(event) => {
              const next: [string, string, string] = [...value]
              next[index] = event.currentTarget.value
              onChange(next)
            }}
          />
        ))}
      </div>
    </Field>
  )
}

// --- The drawer ---------------------------------------------------------------------------------------

export function ModelInspectorDrawer({
  asset,
  modelUrl,
  labels,
  images,
  products,
  projects,
  materials,
  canWrite,
  canVerify,
  canAssociateProduct,
  actions,
}: ModelDrawerProps): React.ReactElement {
  const router = useRouter()
  const reducedMotion = useReducedMotion()
  const close = (): void => {
    router.replace('/studio/media/models')
  }

  const [reinspectState, reinspect, reinspecting] = useActionState(actions.reinspect, IDLE)
  const [stillsState, saveStills, savingStills] = useActionState(actions.stills, IDLE)
  const [settingsState, saveSettings, savingSettings] = useActionState(actions.settings, IDLE)
  const [labelsState, saveLabels, savingLabels] = useActionState(actions.labels, IDLE)
  const [associateState, associate, associating] = useActionState(actions.associate, IDLE)

  const [posterId, setPosterId] = React.useState<string | null>(asset.model_poster_id)
  const [thumbnailId, setThumbnailId] = React.useState<string | null>(asset.model_thumbnail_id)

  const [draft, setDraft] = React.useState<SettingsDraft>(() =>
    draftFrom(parseViewerSettings(asset.viewer_settings)),
  )
  const settings = React.useMemo(() => settingsFrom(draft), [draft])
  const settingsJson = JSON.stringify(settings)
  const [previewOpen, setPreviewOpen] = React.useState(false)

  const [labelRows, setLabelRows] = React.useState(() =>
    labels.map((row) => ({
      variant_key: row.variant_key,
      label: row.label,
      material_id: row.material_id ?? '',
      position: row.position,
      owner_verification: row.owner_verification as Verification,
    })),
  )

  const initialTarget: 'none' | 'product' | 'project' =
    asset.associated_product_id !== null
      ? 'product'
      : asset.associated_project_id !== null
        ? 'project'
        : 'none'
  const [target, setTarget] = React.useState(initialTarget)

  const readOnly = !canWrite
  const title = asset.title ?? asset.filename ?? asset.public_id
  const copy = React.useMemo(() => previewCopy(title), [title])
  const previewVariants = React.useMemo(() => publicVariantLabels(labels), [labels])

  return (
    <Drawer
      open
      onClose={close}
      side="right"
      title={t('studio.models.drawer.title')}
      description={title}
      closeLabel={t('studio.models.drawer.close')}
      data-model-drawer={asset.id}
    >
      <Stack gap={8}>
        {/* --- From the file ------------------------------------------------------------------ */}
        <section aria-labelledby="model-meta-heading">
          <Stack gap={3}>
            <Heading level={3} id="model-meta-heading">
              {t('studio.models.meta.heading')}
            </Heading>
            <Text size="sm" tone="tertiary">
              {t('studio.models.meta.help')}
            </Text>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-model-meta="">
              <dt>{t('studio.models.meta.format')}</dt>
              <dd>{asset.model_format ?? t('studio.models.meta.none')}</dd>
              <dt>{t('studio.models.meta.size')}</dt>
              <dd>
                {asset.file_size_bytes === null
                  ? t('studio.models.notInspected')
                  : megabytes(asset.file_size_bytes)}
              </dd>
              <dt>{t('studio.models.meta.triangles')}</dt>
              <dd>
                {asset.poly_count === null
                  ? t('studio.models.notInspected')
                  : asset.poly_count.toLocaleString('en-GB')}
              </dd>
              <dt>{t('studio.models.meta.textures')}</dt>
              <dd>
                {asset.texture_count === null
                  ? t('studio.models.notInspected')
                  : String(asset.texture_count)}
              </dd>
              <dt>{t('studio.models.meta.variants')}</dt>
              <dd>
                {labels.length === 0
                  ? t('studio.models.meta.none')
                  : labels.map((row) => row.variant_key).join(', ')}
              </dd>
            </dl>
            <form action={reinspect}>
              <input type="hidden" name="asset_id" value={asset.id} />
              <Button type="submit" variant="secondary" disabled={readOnly || reinspecting}>
                {t('studio.models.meta.reinspect')}
              </Button>
            </form>
            <Outcome state={reinspectState} />
          </Stack>
        </section>

        {/* --- Poster and thumbnail --------------------------------------------------------- */}
        <section aria-labelledby="model-stills-heading">
          <form action={saveStills}>
            <input type="hidden" name="asset_id" value={asset.id} />
            <Stack gap={3}>
              <Heading level={3} id="model-stills-heading">
                {t('studio.models.stills.heading')}
              </Heading>
              <MediaPicker
                name="poster_id"
                label={t('studio.models.stills.poster')}
                help={t('studio.models.stills.posterHelp')}
                assets={images}
                value={posterId}
                onChange={setPosterId}
              />
              <MediaPicker
                name="thumbnail_id"
                label={t('studio.models.stills.thumbnail')}
                help={t('studio.models.stills.thumbnailHelp')}
                assets={images}
                value={thumbnailId}
                onChange={setThumbnailId}
              />
              <div>
                <Button type="submit" variant="primary" disabled={readOnly || savingStills}>
                  {t('studio.models.save')}
                </Button>
              </div>
              <Outcome state={stillsState} />
            </Stack>
          </form>
        </section>

        {/* --- Viewer settings ------------------------------------------------------------------ */}
        <section aria-labelledby="model-settings-heading">
          <form action={saveSettings}>
            <input type="hidden" name="asset_id" value={asset.id} />
            <input type="hidden" name="settings" value={settingsJson} />
            <Stack gap={3}>
              <Heading level={3} id="model-settings-heading">
                {t('studio.models.settings.heading')}
              </Heading>
              <Text size="sm" tone="tertiary">
                {t('studio.models.settings.help')}
              </Text>
              <Field label={t('studio.models.settings.lighting')} controlId="model-lighting">
                <Select
                  id="model-lighting"
                  value={draft.lightingPreset}
                  disabled={readOnly}
                  onChange={(event) => {
                    setDraft({
                      ...draft,
                      lightingPreset: event.currentTarget.value as LightingPresetKey | '',
                    })
                  }}
                >
                  <option value="">—</option>
                  {LIGHTING_PRESET_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {copy.lightingPresets[key]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('studio.models.settings.environment')} controlId="model-environment">
                <Select
                  id="model-environment"
                  value={draft.environmentPreset}
                  disabled={readOnly}
                  onChange={(event) => {
                    setDraft({
                      ...draft,
                      environmentPreset: event.currentTarget.value as EnvironmentPresetKey | '',
                    })
                  }}
                >
                  <option value="">—</option>
                  {ENVIRONMENT_PRESET_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {copy.environmentPresets[key]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('studio.models.settings.exposure')} controlId="model-exposure">
                <Input
                  id="model-exposure"
                  inputMode="decimal"
                  value={draft.exposure}
                  disabled={readOnly}
                  onChange={(event) => {
                    setDraft({ ...draft, exposure: event.currentTarget.value })
                  }}
                />
              </Field>
              <Field
                label={t('studio.models.settings.autoRotate')}
                controlId="model-autorotate"
                help={t('studio.models.settings.autoRotateHelp')}
              >
                <Checkbox
                  id="model-autorotate"
                  checked={draft.autoRotate}
                  disabled={readOnly}
                  onChange={(event) => {
                    setDraft({ ...draft, autoRotate: event.currentTarget.checked })
                  }}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('studio.models.settings.minDistance')} controlId="model-min">
                  <Input
                    id="model-min"
                    inputMode="decimal"
                    value={draft.minDistance}
                    disabled={readOnly}
                    onChange={(event) => {
                      setDraft({ ...draft, minDistance: event.currentTarget.value })
                    }}
                  />
                </Field>
                <Field label={t('studio.models.settings.maxDistance')} controlId="model-max">
                  <Input
                    id="model-max"
                    inputMode="decimal"
                    value={draft.maxDistance}
                    disabled={readOnly}
                    onChange={(event) => {
                      setDraft({ ...draft, maxDistance: event.currentTarget.value })
                    }}
                  />
                </Field>
              </div>
              <Vec3Fields
                idBase="model-position"
                label={t('studio.models.settings.cameraPosition')}
                value={draft.position}
                disabled={readOnly}
                onChange={(position) => {
                  setDraft({ ...draft, position })
                }}
              />
              <Vec3Fields
                idBase="model-target"
                label={t('studio.models.settings.cameraTarget')}
                value={draft.target}
                disabled={readOnly}
                onChange={(target) => {
                  setDraft({ ...draft, target })
                }}
              />
              <Field label={t('studio.models.settings.fov')} controlId="model-fov">
                <Input
                  id="model-fov"
                  inputMode="decimal"
                  value={draft.fov}
                  disabled={readOnly}
                  onChange={(event) => {
                    setDraft({ ...draft, fov: event.currentTarget.value })
                  }}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary" disabled={readOnly || savingSettings}>
                  {t('studio.models.save')}
                </Button>
                {modelUrl === null ? null : (
                  <Button
                    type="button"
                    variant="secondary"
                    aria-pressed={previewOpen}
                    onClick={() => {
                      setPreviewOpen((open) => !open)
                    }}
                    data-model-preview-toggle=""
                  >
                    {t('studio.models.preview.open')}
                  </Button>
                )}
              </div>
              <Outcome state={settingsState} />
            </Stack>
          </form>

          {previewOpen && modelUrl !== null ? (
            <Stack gap={2} data-model-preview="">
              <Heading level={4}>{t('studio.models.preview.heading')}</Heading>
              <Text size="sm" tone="tertiary">
                {t('studio.models.preview.help')}
              </Text>
              <ModelViewer
                key={settingsJson}
                modelUrl={modelUrl}
                format={asset.model_format ?? 'GLB'}
                settings={settings}
                variants={previewVariants}
                materialNames={Object.fromEntries(materials.map((m) => [m.id, m.label]))}
                dimensions={null}
                isConcept={asset.is_concept}
                copy={copy}
                reducedMotion={reducedMotion}
                fullscreenByDefault={false}
                onClose={() => {
                  setPreviewOpen(false)
                }}
                onError={() => {
                  setPreviewOpen(false)
                }}
              />
            </Stack>
          ) : null}
        </section>

        {/* --- Finish labels --------------------------------------------------------------------- */}
        <section aria-labelledby="model-labels-heading">
          <form action={saveLabels}>
            <input type="hidden" name="asset_id" value={asset.id} />
            <input
              type="hidden"
              name="labels"
              value={JSON.stringify(
                labelRows.map((row) => ({
                  ...row,
                  material_id: row.material_id === '' ? null : row.material_id,
                })),
              )}
            />
            <Stack gap={3}>
              <Heading level={3} id="model-labels-heading">
                {t('studio.models.labels.heading')}
              </Heading>
              <Text size="sm" tone="tertiary">
                {t('studio.models.labels.help')}
              </Text>
              {labelRows.length === 0 ? (
                <Text size="sm">{t('studio.models.labels.none')}</Text>
              ) : (
                <ul className="divide-y divide-line" data-model-labels="">
                  {labelRows.map((row, index) => (
                    <li key={row.variant_key} className="py-3">
                      <Stack gap={2}>
                        <div className="flex items-center gap-2">
                          <Badge tone="neutral">{row.variant_key}</Badge>
                          <Text size="sm" tone="tertiary">
                            {t('studio.models.labels.key')}
                          </Text>
                        </div>
                        <Field label={t('studio.models.labels.label')} controlId={`label-${index}`}>
                          <Input
                            id={`label-${index}`}
                            value={row.label}
                            disabled={readOnly}
                            onChange={(event) => {
                              const next = [...labelRows]
                              next[index] = { ...row, label: event.currentTarget.value }
                              setLabelRows(next)
                            }}
                          />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field
                            label={t('studio.models.labels.material')}
                            controlId={`material-${index}`}
                          >
                            <Select
                              id={`material-${index}`}
                              value={row.material_id}
                              disabled={readOnly}
                              onChange={(event) => {
                                const material_id = event.currentTarget.value
                                const next = [...labelRows]
                                next[index] = {
                                  ...row,
                                  material_id,
                                  // A material lifts the row out of NOT_REQUIRED; the constraint
                                  // would refuse it otherwise, so the form does it first.
                                  owner_verification:
                                    material_id !== '' && row.owner_verification === 'NOT_REQUIRED'
                                      ? 'OWNER_VERIFICATION_REQUIRED'
                                      : row.owner_verification,
                                }
                                setLabelRows(next)
                              }}
                            >
                              <option value="">{t('studio.models.labels.noMaterial')}</option>
                              {materials.map((material) => (
                                <option key={material.id} value={material.id}>
                                  {material.label}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field
                            label={t('studio.models.labels.verification')}
                            controlId={`verify-${index}`}
                          >
                            <Select
                              id={`verify-${index}`}
                              value={row.owner_verification}
                              disabled={readOnly}
                              onChange={(event) => {
                                const next = [...labelRows]
                                next[index] = {
                                  ...row,
                                  owner_verification: event.currentTarget.value as Verification,
                                }
                                setLabelRows(next)
                              }}
                            >
                              {VERIFICATIONS.map((state) => (
                                <option
                                  key={state}
                                  value={state}
                                  disabled={
                                    (state === 'NOT_REQUIRED' && row.material_id !== '') ||
                                    (state === 'VERIFIED' && !canVerify)
                                  }
                                >
                                  {t(`studio.models.labels.verify.${state}`)}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        </div>
                      </Stack>
                    </li>
                  ))}
                </ul>
              )}
              {labelRows.length === 0 ? null : (
                <div>
                  <Button type="submit" variant="primary" disabled={readOnly || savingLabels}>
                    {t('studio.models.save')}
                  </Button>
                </div>
              )}
              <Outcome state={labelsState} />
            </Stack>
          </form>
        </section>

        {/* --- Shown on ------------------------------------------------------------------------- */}
        <section aria-labelledby="model-association-heading">
          <form action={associate}>
            <input type="hidden" name="asset_id" value={asset.id} />
            <Stack gap={3}>
              <Heading level={3} id="model-association-heading">
                {t('studio.models.association.heading')}
              </Heading>
              <Text size="sm" tone="tertiary">
                {t('studio.models.association.help')}
              </Text>
              <Field label={t('studio.models.association.heading')} controlId="model-target">
                <Select
                  id="model-target"
                  name="target"
                  value={target}
                  disabled={readOnly}
                  onChange={(event) => {
                    setTarget(event.currentTarget.value as typeof target)
                  }}
                >
                  <option value="none">{t('studio.models.association.none')}</option>
                  <option value="product" disabled={!canAssociateProduct}>
                    {t('studio.models.association.product')}
                  </option>
                  <option value="project">{t('studio.models.association.project')}</option>
                </Select>
              </Field>
              {target === 'product' ? (
                <Field label={t('studio.models.association.product')} controlId="model-product">
                  <Select
                    id="model-product"
                    name="product_id"
                    defaultValue={asset.associated_product_id ?? ''}
                    disabled={readOnly}
                  >
                    <option value="">{t('studio.models.association.pick')}</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              {target === 'project' ? (
                <Field label={t('studio.models.association.project')} controlId="model-project">
                  <Select
                    id="model-project"
                    name="project_id"
                    defaultValue={asset.associated_project_id ?? ''}
                    disabled={readOnly}
                  >
                    <option value="">{t('studio.models.association.pick')}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <div>
                <Button type="submit" variant="primary" disabled={readOnly || associating}>
                  {t('studio.models.save')}
                </Button>
              </div>
              <Outcome state={associateState} />
            </Stack>
          </form>
        </section>
      </Stack>
    </Drawer>
  )
}
