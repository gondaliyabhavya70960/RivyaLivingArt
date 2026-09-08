/**
 * The two WhatsApp message templates (SEED §36 and §37) and the tokens each one may contain.
 *
 * THE ALLOWLIST IS THE SECURITY BOUNDARY, and it points in both directions.
 *
 *   * A token in the TEMPLATE that is not on the list throws. Templates are editable in Studio, so
 *     without this an editor could type `{{service_role_key}}` — or, far more likely, mistype
 *     `{{customer_nane}}` — and the message would go to a customer with the raw braces in it.
 *   * A key in the VALUES that is not on the list throws. Interpolating whatever the caller passed
 *     is how an internal field ends up in a message: the day a caller spreads a database row into
 *     the values object, every column in it becomes a candidate for substitution.
 *
 * Neither direction is a lint rule or a convention. Both are checked at the moment of rendering,
 * because the template is data and the values come from a form.
 *
 * THE TOKEN NAMES ARE THE SPECIFICATION'S, VERBATIM. Phase 20 substitutes them and Phase 09 seeded
 * the templates containing them; renaming one here would produce a message with an unsubstituted
 * placeholder in it, which is exactly the failure the seed module's own comment warns about.
 */

/** SEED §36 — a product or project enquiry. */
export const INQUIRY_TOKENS = [
  'product_or_project',
  'customer_name',
  'phone',
  'city',
  'customization_summary',
  'notes',
  'reference_urls',
  'inquiry_id',
] as const

/** SEED §37 — a custom commission. */
export const COMMISSION_TOKENS = [
  'project_type',
  'dimensions',
  'city',
  'material_direction',
  'notes',
  'reference_urls',
  'inquiry_id',
] as const

export type InquiryToken = (typeof INQUIRY_TOKENS)[number]
export type CommissionToken = (typeof COMMISSION_TOKENS)[number]
export type WhatsAppToken = InquiryToken | CommissionToken

/** Which `global_content` row under `WHATSAPP_TEMPLATE` a message is rendered from. */
export const TEMPLATE_KEYS = {
  inquiry: 'WHATSAPP_TEMPLATE.inquiry',
  commission: 'WHATSAPP_TEMPLATE.commission',
} as const

export type TemplateName = keyof typeof TEMPLATE_KEYS

const TOKENS_FOR: Record<TemplateName, readonly string[]> = {
  inquiry: INQUIRY_TOKENS,
  commission: COMMISSION_TOKENS,
}

export function allowedTokens(template: TemplateName): readonly string[] {
  return TOKENS_FOR[template]
}

/** `{{token}}`, with no whitespace tolerance — the seeded templates have none, and accepting
 *  `{{ token }}` too would mean two spellings of the same token and one of them silently unmatched. */
const TOKEN_PATTERN = /\{\{([a-z_]+)\}\}/g

export class WhatsAppTemplateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WhatsAppTemplateError'
  }
}

/** Every token the template asks for, in order of first appearance, deduplicated. */
export function tokensIn(template: string): readonly string[] {
  return [...new Set([...template.matchAll(TOKEN_PATTERN)].map((match) => match[1] ?? ''))]
}

export type TokenValues = Readonly<Record<string, string>>

/**
 * Substitute, or throw.
 *
 * A TOKEN WITH NO VALUE BECOMES AN EMPTY LINE, NOT AN ERROR. `{{notes}}` when the visitor wrote no
 * notes is the ordinary case, and refusing to render would block a legitimate enquiry over an
 * optional field. What is refused is a token nobody declared — that is a mistake in the template or
 * in the caller, and both are ours to fix rather than the customer's to receive.
 */
export function renderTemplate(template: TemplateName, body: string, values: TokenValues): string {
  const allowed = new Set(allowedTokens(template))

  for (const token of tokensIn(body)) {
    if (!allowed.has(token)) {
      throw new WhatsAppTemplateError(
        `the ${template} template contains {{${token}}}, which is not one of its declared tokens`,
      )
    }
  }

  for (const key of Object.keys(values)) {
    if (!allowed.has(key)) {
      throw new WhatsAppTemplateError(
        `${key} is not a token of the ${template} template, so it will not be substituted`,
      )
    }
  }

  return body.replace(TOKEN_PATTERN, (_match, token: string) => values[token] ?? '')
}
