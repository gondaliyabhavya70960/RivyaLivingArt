import type { FieldIssue } from '@/components/studio/FormField'
import type { ValidationIssue } from '@/lib/catalog/validation'

import type { TabActionState } from '@/app/(studio)/studio/(shell)/catalog/products/[productId]/tab-actions'

/**
 * `ValidationIssue.field` becomes `FieldIssue.path`, once, for all four tabs.
 *
 * The two names are not a mistake to unify: `path` is the form layer's word for "which control",
 * `field` is the rule layer's word for "which column", and `lib/catalog/validation.ts` is pure and
 * knows nothing about forms — which is exactly what lets a Server Action reuse it. The translation
 * belongs at the boundary. `ProductForm` does the same mapping inline; the tabs need it in eight
 * places across four files, which is where inline becomes eight chances to write it differently.
 */
export function fieldIssues(state: TabActionState): readonly FieldIssue[] {
  const issues: readonly ValidationIssue[] = state.status === 'error' ? state.issues : []
  return issues.map((issue) => ({ path: issue.field, message: issue.message }))
}
