import * as React from 'react'
import { cn } from '@/lib/ui/cn'
import { Label } from '@/components/primitives/Label'
import { HelpText } from '@/components/primitives/HelpText'
import { ErrorText } from '@/components/primitives/ErrorText'

/**
 * Field owns the id relationships so no consumer has to (§7.4):
 *
 *   <Label htmlFor={id} required>       label / 500 / --rv-ink-primary
 *   <HelpText id={helpId}>              text-sm / --rv-ink-tertiary   (ABOVE the control)
 *   {control aria-describedby="helpId errorId" aria-invalid aria-required}
 *   <ErrorText id={errorId} role=alert> text-sm / --rv-state-danger + icon   (BELOW)
 *
 * MECHANISM — `useId` + `cloneElement`, deliberately not React context. `createContext`
 * is not exported from the react-server build, so a context Field would have to be a
 * Client Component *and* would drag every control that reads the context into the client
 * bundle with it. `useId`, `isValidElement` and `cloneElement` all exist on the server,
 * so Field, Input and Textarea stay Server Components and a form with no interactivity
 * ships no JavaScript at all. The price is one contract: `children` is the single control
 * element, and it must spread its rest props onto its DOM node. Every primitive here does.
 *
 * SPACING — label -> control and control -> error are both --rv-space-2, which the one
 * `gap-2` gives (help sits inside that rhythm). Field -> field is --rv-space-5 and belongs
 * to the enclosing stack: a margin here would sum with the parent's `gap-5` instead of
 * collapsing against it.
 */

/**
 * The only props Field injects. Kept narrow so cloning cannot smuggle anything else in.
 *
 * `aria-required` rather than the native `required` attribute, for three reasons. Field
 * wraps whatever control it is handed — Input, Textarea, Select, but also Switch, which is
 * a <button role="switch"> where `required` is not a valid attribute at all. Field's whole
 * injected contract is already ARIA state (`aria-invalid` carries invalid, not the native
 * constraint API), and one model is easier to reason about than two. And native `required`
 * would switch browser validation bubbles on for every form in the product, which §7.10
 * does not describe: an inquiry is validated on the way to being persisted, and the answer
 * comes back as an `error` rendered by ErrorText. A control that genuinely wants native
 * constraint validation still passes `required` itself and cloneElement leaves it alone.
 */
type ControlProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: React.AriaAttributes['aria-invalid']
  'aria-required'?: React.AriaAttributes['aria-required']
}

interface FieldOwnProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The visible label. Content, so it is a prop — never a literal in a component. */
  label: React.ReactNode
  /** Format hint, rendered above the control and linked by aria-describedby. */
  help?: React.ReactNode
  /** The error message. Its presence is what makes the field invalid; there is no flag. */
  error?: React.ReactNode
  /**
   * id for the CONTROL. Defaults to the control's own id, then to a generated one.
   * `id` in ...rest lands on the wrapper, as it would on any div.
   */
  controlId?: string
  /** Exactly one control element — an Input, a Textarea, a Select. */
  children: React.ReactNode
}

/**
 * `required` and `requiredLabel` travel together, enforced by the type rather than by a
 * review comment. §7.4 marks a required field with the WORD, and §2 rule 2 says the word
 * is content that arrives from `global_content`; Label therefore renders no marker at all
 * without it. Left as two independent optional props, `<Field required>` compiled fine and
 * shipped a field a sighted visitor could not tell apart from an optional one.
 *
 * The `required: boolean` member — rather than the narrower `required: true` — is what
 * keeps `required={schema.isRequired}` assignable: a boolean-typed variable matches no
 * literal-typed member, and a type that only accepts the constant is a type people work
 * around with a cast.
 */
type RequiredMarker =
  | {
      /** Marks the field required. Renders `requiredLabel` in the label (§7.4). */
      required?: false | undefined
      /** The word used as the required marker, e.g. "Required". From `global_content`. */
      requiredLabel?: string
    }
  | {
      /** Marks the field required. Renders `requiredLabel` in the label (§7.4). */
      required: boolean
      /** The word used as the required marker, e.g. "Required". From `global_content`. */
      requiredLabel: string
    }

export type FieldProps = FieldOwnProps & RequiredMarker

export const Field = React.forwardRef<HTMLDivElement, FieldProps>(function Field(
  { label, help, error, required = false, requiredLabel, controlId, className, children, ...rest },
  ref,
) {
  const generatedId = React.useId()
  const control = React.isValidElement<ControlProps>(children) ? children : null
  // A control that arrived with an id keeps it: a form library or an autofill rule may
  // already be pointing at that id, and re-labelling it underneath them is a defect.
  const id = controlId ?? control?.props.id ?? generatedId

  const hasHelp = Boolean(help)
  const hasError = Boolean(error)
  const helpId = hasHelp ? `${id}-help` : undefined
  const errorId = hasError ? `${id}-error` : undefined

  // Space-joined, omitting whichever is absent, and never discarding a description the
  // control already carried (a character counter, an "opens in a new tab" note).
  const describedBy = [helpId, errorId, control?.props['aria-describedby']]
    .filter((token): token is string => Boolean(token))
    .join(' ')

  return (
    <div ref={ref} className={cn('flex flex-col gap-2', className)} {...rest}>
      <Label htmlFor={id} required={required} requiredLabel={requiredLabel}>
        {label}
      </Label>
      {hasHelp ? <HelpText id={helpId}>{help}</HelpText> : null}
      {control
        ? React.cloneElement(control, {
            id,
            'aria-describedby': describedBy === '' ? undefined : describedBy,
            'aria-invalid': hasError ? true : control.props['aria-invalid'],
            // The word in the label is the visible half of WCAG 3.3.2; this is the half
            // assistive tech reads. Neither one substitutes for the other.
            'aria-required': required ? true : control.props['aria-required'],
          })
        : children}
      {hasError ? <ErrorText id={errorId}>{error}</ErrorText> : null}
    </div>
  )
})
