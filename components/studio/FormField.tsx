import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Textarea } from '@/components/primitives/Textarea'

/**
 * One labelled control, wired to a Zod issue.
 *
 * WHAT THIS ADDS OVER `primitives/Field`. Field owns the label, help text, error text and the
 * `aria-describedby` wiring. What it does not know about is the shape server-side validation
 * returns, and that seam is where server-rendered forms usually lose their errors: the action
 * returns a `ValidationError` with `issues`, and every call site writes its own lookup from field
 * name to message. Ten call sites, ten chances for a field whose error silently never displays.
 *
 * `errorFor` is that lookup, once. A field with no matching issue renders no error, which is the
 * ordinary case; a field with one renders it through Field, which already handles the wiring.
 *
 * IT IS NOT A CLIENT COMPONENT. These forms post to Server Actions and re-render with the errors
 * in place, so nothing here needs state. That is also what makes them work with JavaScript off —
 * the property the login page is already tested for.
 */
export type FieldIssue = { path: string; message: string }

/**
 * The required marker, as a shape `Field` will actually accept.
 *
 * `Field` types `required` and `requiredLabel` as a discriminated union so they cannot be separated
 * — §7.4 marks a required field with a WORD, and `<Field required>` on its own once shipped a field
 * a sighted visitor could not tell apart from an optional one. TypeScript cannot narrow that union
 * through a spread of a conditional object literal, so the branch happens here, with the union as
 * the return type. Casting past it would give back exactly the guarantee the union exists to make.
 */
type RequiredMarker = { required: true; requiredLabel: string } | { required?: false }

function requiredMarker(required: boolean | undefined, label: string | undefined): RequiredMarker {
  return required === true && label !== undefined
    ? { required: true, requiredLabel: label }
    : { required: false }
}

/** The first issue for this field, or undefined. First rather than all: a control shows one error. */
export function errorFor(
  issues: readonly FieldIssue[] | undefined,
  name: string,
): string | undefined {
  return issues?.find((issue) => issue.path === name)?.message
}

type Common = {
  /** The form field name. Also the key `errorFor` matches on. */
  name: string
  /** Resolved copy. Never a literal at the call site. */
  label: string
  help?: string
  issues?: readonly FieldIssue[]
  defaultValue?: string
  /** `required` and its word travel together — see primitives/Field. */
  required?: boolean
  requiredLabel?: string
}

export function TextField({
  name,
  label,
  help,
  issues,
  defaultValue,
  required,
  requiredLabel,
  type = 'text',
  autoComplete,
}: Common & { type?: 'text' | 'email' | 'password' | 'url' | 'date'; autoComplete?: string }) {
  const error = errorFor(issues, name)
  return (
    <Field
      label={label}
      help={help}
      error={error}
      controlId={name}
      {...requiredMarker(required, requiredLabel)}
    >
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        // `aria-invalid` as well as the visible error: a screen-reader user moving by form control
        // hears the state on the control itself, not only when they reach the message below it.
        aria-invalid={error !== undefined ? true : undefined}
      />
    </Field>
  )
}

export function TextAreaField({
  name,
  label,
  help,
  issues,
  defaultValue,
  required,
  requiredLabel,
  rows = 4,
}: Common & { rows?: number }) {
  const error = errorFor(issues, name)
  return (
    <Field
      label={label}
      help={help}
      error={error}
      controlId={name}
      {...requiredMarker(required, requiredLabel)}
    >
      <Textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        aria-invalid={error !== undefined ? true : undefined}
      />
    </Field>
  )
}

export function SelectField({
  name,
  label,
  help,
  issues,
  defaultValue,
  required,
  requiredLabel,
  options,
}: Common & { options: readonly { value: string; label: string }[] }) {
  const error = errorFor(issues, name)
  return (
    <Field
      label={label}
      help={help}
      error={error}
      controlId={name}
      {...requiredMarker(required, requiredLabel)}
    >
      <Select
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error !== undefined ? true : undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  )
}
