import type { ValidationIssue } from '@/lib/catalog/validation'

/**
 * What a Studio form knows about its last submission.
 *
 * IT LIVES HERE RATHER THAN IN AN EDITOR, and that is the whole point of the file. `ActionForm`
 * used to type its `action` prop by importing `CollectionActionState` from the collection editor —
 * so every other editor's actions were accepted only because they happened to have the same shape,
 * and the shared component depended on one particular screen. That coupling has already cost
 * something once: the project editor reused the collection editor's relation action for the same
 * "it type-checks" reason, and that action hardcodes `source_type = 'COLLECTION'`.
 *
 * THE PARAMETER POSITION IS WHY A SHARED NAME MATTERS, not tidiness. An action's state parameter is
 * contravariant, so an action taking a WIDER state — one carrying an extra field, say — is not
 * assignable where a narrower one is expected, however similar the two look. Naming the contract
 * once means an editor either meets it or does not, rather than discovering it through an error
 * about a module it has no reason to import.
 */
export type StudioFormState =
  | { readonly status: 'idle' }
  | { readonly status: 'saved' }
  | { readonly status: 'error'; readonly issues: readonly ValidationIssue[] }

/** An action shaped for `useActionState`, over the state above. */
export type StudioFormAction = (state: StudioFormState, form: FormData) => Promise<StudioFormState>

/** The starting state, so no call site invents its own. */
export const IDLE_FORM_STATE: StudioFormState = { status: 'idle' }

/** The issues a form should render, as `FormField` wants them. `field` is the rule layer's word for
 *  a column and `path` is the form layer's word for a control; the translation belongs here. */
export function formIssues(state: StudioFormState): readonly { path: string; message: string }[] {
  const issues: readonly ValidationIssue[] = state.status === 'error' ? state.issues : []
  return issues.map((issue) => ({ path: issue.field, message: issue.message }))
}
