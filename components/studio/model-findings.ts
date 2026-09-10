import { t, type StudioStringKey } from './strings'
import type { Finding, RejectionCode, WarningCode } from '@/lib/media/inspect'

/**
 * Inspection findings as Studio sentences. Shared by the uploader (in the browser, before the
 * upload) and the Server Actions (after it), so the same code reads the same way in both places.
 */

const REJECTION_KEY: Readonly<Record<RejectionCode, StudioStringKey>> = {
  'wrong-format': 'studio.models.reject.wrongFormat',
  unparseable: 'studio.models.reject.unparseable',
  'too-large': 'studio.models.reject.tooLarge',
  'compression-required': 'studio.models.reject.compressionRequired',
  'too-many-triangles': 'studio.models.reject.tooManyTriangles',
  'texture-too-large': 'studio.models.reject.textureTooLarge',
  'external-resources': 'studio.models.reject.externalResources',
}

const WARNING_KEY: Readonly<Record<WarningCode, StudioStringKey>> = {
  large: 'studio.models.warn.large',
  'many-triangles': 'studio.models.warn.manyTriangles',
  'many-textures': 'studio.models.warn.manyTextures',
}

/** Bytes as megabytes with one decimal, for a sentence. */
export function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function withDetail(template: string, code: string, detail: string | null): string {
  if (detail === null) return template
  const numeric = Number(detail)
  const shown =
    Number.isFinite(numeric) && /large|compression/.test(code)
      ? megabytes(numeric)
      : Number.isFinite(numeric)
        ? numeric.toLocaleString('en-GB')
        : detail
  return template.replace('{{detail}}', shown)
}

export function rejectionMessage(finding: Finding<RejectionCode>): string {
  return withDetail(t(REJECTION_KEY[finding.code]), finding.code, finding.detail)
}

export function warningMessage(finding: Finding<WarningCode>): string {
  return withDetail(t(WARNING_KEY[finding.code]), finding.code, finding.detail)
}
