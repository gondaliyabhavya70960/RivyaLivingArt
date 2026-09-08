import 'server-only'

import { cloudinaryProvider } from './providers/cloudinary'
import type { MediaProvider } from './types'

/**
 * The one place a provider is chosen.
 *
 * D1 fixes Cloudinary "behind a `MediaProvider` abstraction", and the deliverables table calls
 * this "the only export other modules use". Both mean the same thing: no module outside
 * `lib/media/` names a provider, so swapping one is an edit here rather than a search.
 *
 * THERE IS NO REGISTRY AND NO ENVIRONMENT SWITCH, deliberately. A `MEDIA_PROVIDER=cloudinary`
 * variable would suggest a second implementation exists and can be selected at deploy time;
 * neither is true, and a configuration knob that has exactly one valid value is a way for a
 * production environment to be misconfigured into a state that cannot work. When a second provider
 * is genuinely written, this function is where the choice goes.
 *
 * `server-only`, because the provider it returns holds the API secret. Client Components that need
 * a delivery URL import `lib/media/url.ts` instead, which needs nothing but the public cloud name.
 */
export function getMediaProvider(): MediaProvider {
  return cloudinaryProvider
}

export { SIGNATURE_TTL_SECONDS } from './providers/cloudinary'
