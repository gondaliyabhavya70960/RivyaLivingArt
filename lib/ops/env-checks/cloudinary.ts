import { outcomeForError, outcomeForHttp, type EnvCheck } from './types'

/**
 * A signed ping of the account usage endpoint. The credentials travel in the Authorization header
 * of this one request and nowhere else — not into the result, not into a log, not into a URL.
 */
export const cloudinary: EnvCheck = {
  id: 'cloudinary',
  requires: ['NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
  channel: 'MEDIA',
  async probe({ fetch, env, signal }) {
    const cloud = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ''
    const auth = Buffer.from(
      `${env.CLOUDINARY_API_KEY ?? ''}:${env.CLOUDINARY_API_SECRET ?? ''}`,
    ).toString('base64')
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/usage`,
        { headers: { authorization: `Basic ${auth}` }, signal },
      )
      return outcomeForHttp(response.status)
    } catch (error) {
      return outcomeForError(error)
    }
  },
}
