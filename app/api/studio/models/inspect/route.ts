import { NextResponse } from 'next/server'

import { AuthenticationError, AuthorizationError, requirePermission } from '@/lib/auth/require'
import { inspectModel } from '@/lib/media/inspect-server'
import { MODEL_CEILINGS, detectModelFormat } from '@/lib/media/model'

/**
 * `POST /api/studio/models/inspect` — the inspector as an endpoint.
 *
 * Takes a multipart body with one `file` and returns the same report `saveModelAction` acts on,
 * without uploading, saving or destroying anything. It exists for the Studio's "check before you
 * upload" case and for tooling; the upload path does not depend on it, because a request body
 * that must carry the whole model is capped by the hosting platform well below the 15 MB ceiling,
 * while the save path reads the file back from the delivery origin instead.
 */

export const runtime = 'nodejs'

export async function POST(request: Request): Promise<Response> {
  try {
    await requirePermission('media.write')
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: 'authentication_required' }, { status: 401 })
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    throw error
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  if (file.size > MODEL_CEILINGS.rejectBytes * 2) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 })
  }

  const format = detectModelFormat({ mimeType: file.type, filename: file.name })
  if (format === null) return NextResponse.json({ error: 'wrong_format' }, { status: 422 })

  const report = await inspectModel(new Uint8Array(await file.arrayBuffer()), format)
  return NextResponse.json(report, { headers: { 'cache-control': 'no-store' } })
}
