/**
 * The only module the rest of the product imports for WhatsApp.
 *
 * `scripts/site/check-whatsapp-usage.mjs` enforces two things around this barrel: no literal
 * `wa.me` or `api.whatsapp.com` anywhere outside `lib/whatsapp/**`, and `buildDirectContactUrl`
 * importable only from the announcement bar, the footer and the contact page. `buildHandoffUrl`
 * needs no import allowlist — its required `inquiryId` already makes a premature call impossible.
 */
export {
  buildDirectContactUrl,
  buildHandoffUrl,
  type DirectContactInput,
  type DirectContactSource,
  type HandoffInput,
  type HandoffUrl,
} from './link'
export {
  allowedTokens,
  COMMISSION_TOKENS,
  INQUIRY_TOKENS,
  renderTemplate,
  TEMPLATE_KEYS,
  tokensIn,
  WhatsAppTemplateError,
  type CommissionToken,
  type InquiryToken,
  type TemplateName,
  type TokenValues,
  type WhatsAppToken,
} from './templates'
export {
  dropEmptyTokenLines,
  MAX_ENCODED_URL_LENGTH,
  PROTECTED_TOKEN,
  shorten,
  type ShortenLevel,
  type ShortenResult,
} from './shorten'
export { CONTACT_KEYS, normaliseE164, resolveWhatsAppNumber } from './number'
