import { notFound } from 'next/navigation'
import { Specimen, State, SchemeBand } from '@/components/devtools/Specimen'
import { Button } from '@/components/primitives/Button'
import { IconButton } from '@/components/primitives/IconButton'
import { TextLink } from '@/components/primitives/TextLink'
import { Spinner } from '@/components/primitives/Spinner'
import { Field } from '@/components/primitives/Field'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { Select } from '@/components/primitives/Select'
import { Checkbox } from '@/components/primitives/Checkbox'
import { Radio } from '@/components/primitives/Radio'
import { Switch } from '@/components/primitives/Switch'
import { Breadcrumbs } from '@/components/primitives/Breadcrumbs'

/**
 * The design-system gallery. Dev-only by an explicit guard, not by accident of routing:
 * this must be a real, reachable route under `next dev` so it can be opened, tabbed
 * through and axe-scanned, and must not resolve at all in a production build.
 *
 * The segment is deliberately NOT underscore-prefixed — a `_`-prefixed directory is a
 * Next.js private folder, opted out of routing entirely, which would produce no route
 * to test rather than a guarded one.
 */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main className="mx-auto max-w-(--container-wide) px-(--rv-gutter) py-16">
      <h1 className="font-display text-display-lg text-ink leading-heading tracking-heading">
        Rivya design system
      </h1>
      <p className="text-ink-secondary mt-3 max-w-(--rv-container-prose) text-lg">
        Every primitive with its states. Development build only.
      </p>
      <nav className="mt-6" aria-label="Design system sections">
        <TextLink href="/design-system/patterns">Behavioural patterns</TextLink>
      </nav>

      <Specimen name="Button" note="Five variants, three sizes. Loading keeps the accessible name.">
        <State label="primary">
          <Button variant="primary">Commission a Piece</Button>
        </State>
        <State label="secondary">
          <Button variant="secondary">View the Collection</Button>
        </State>
        <State label="ghost">
          <Button variant="ghost">Read the Journal</Button>
        </State>
        <State label="quiet">
          <Button variant="quiet">Duplicate</Button>
        </State>
        <State label="danger">
          <Button variant="danger">Delete</Button>
        </State>
        <State label="disabled">
          <Button disabled>Unavailable</Button>
        </State>
        <State label="loading">
          <Button loading>Saving</Button>
        </State>
        <State label="sm">
          <Button size="sm">Small</Button>
        </State>
        <State label="lg">
          <Button size="lg">Large</Button>
        </State>
      </Specimen>

      <Specimen name="IconButton" note="44x44 minimum at every size; aria-label is required.">
        <State label="default">
          <IconButton aria-label="Close">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </IconButton>
        </State>
      </Specimen>

      <Specimen
        name="TextLink"
        note="Underline is not removable — colour alone is not an affordance."
      >
        <State label="inline">
          <TextLink href="/design-system">A link inside a sentence</TextLink>
        </State>
      </Specimen>

      <Specimen name="Spinner">
        <State label="sm">
          <Spinner size="sm" />
        </State>
        <State label="with label">
          <Spinner label="Loading products" />
        </State>
      </Specimen>

      <Specimen name="Breadcrumbs" note="Last item is aria-current and not a link.">
        <State label="default">
          <Breadcrumbs
            aria-label="Breadcrumb"
            items={[
              { label: 'Collection', href: '/collection' },
              { label: 'Furniture', href: '/collection/furniture' },
              { label: 'Console table', href: '/product/console-table' },
            ]}
          />
        </State>
      </Specimen>

      <Specimen
        name="Field + Input"
        note="Help above the control, error below, both aria-describedby linked."
      >
        <State label="default">
          <Field label="Name">
            <Input name="name" autoComplete="name" />
          </Field>
        </State>
        <State label="with help">
          <Field label="Phone" help="Include the country code.">
            <Input name="phone" inputMode="tel" autoComplete="tel" />
          </Field>
        </State>
        <State label="error">
          <Field label="Email" error="Enter a valid email address.">
            <Input name="email" autoComplete="email" />
          </Field>
        </State>
      </Specimen>

      <Specimen name="Textarea">
        <State label="default">
          <Field label="Project notes">
            <Textarea name="notes" rows={3} />
          </Field>
        </State>
      </Specimen>

      <Specimen name="Select">
        <State label="default">
          <Field label="Enquiry type">
            <Select name="type" defaultValue="large-format">
              <option value="large-format">Large-Format Furniture</option>
              <option value="custom">Custom Furniture</option>
              <option value="preservation">Preservation</option>
            </Select>
          </Field>
        </State>
      </Specimen>

      <Specimen name="Checkbox / Radio / Switch">
        <State label="checkbox">
          <Checkbox name="ref" label="I have reference images" />
        </State>
        <State label="radio">
          <Radio name="scale" value="large" label="Large format" />
        </State>
        <State label="switch">
          <Switch onLabel="Published" offLabel="Draft" />
        </State>
      </Specimen>

      <Specimen name="Colour schemes" note="The same components on all three grounds.">
        <div className="grid w-full gap-4 md:grid-cols-3">
          <SchemeBand scheme="deep">
            <Button variant="primary">Enquire</Button>
          </SchemeBand>
          <SchemeBand scheme="ink">
            <Button variant="primary">Enquire</Button>
          </SchemeBand>
          <SchemeBand scheme="bone">
            <Button variant="primary">Enquire</Button>
          </SchemeBand>
        </div>
      </Specimen>
    </main>
  )
}
