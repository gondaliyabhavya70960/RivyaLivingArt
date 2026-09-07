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
import { Heading } from '@/components/primitives/Heading'
import { Text } from '@/components/primitives/Text'
import { Eyebrow } from '@/components/primitives/Eyebrow'
import { Divider } from '@/components/primitives/Divider'
import { Badge } from '@/components/primitives/Badge'
import { Tag } from '@/components/primitives/Tag'
import { Surface } from '@/components/primitives/Surface'
import { Stack } from '@/components/primitives/Stack'
import { Cluster } from '@/components/primitives/Cluster'
import { Grid } from '@/components/primitives/Grid'
import { AspectBox } from '@/components/primitives/AspectBox'
import { MediaFrame } from '@/components/primitives/MediaFrame'
import { Skeleton } from '@/components/primitives/Skeleton'

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
          <Switch label="Publication state" onLabel="Published" offLabel="Draft" />
        </State>
      </Specimen>

      <Specimen
        name="Heading"
        note="Level and visual size are independent — the outline stays correct however big the type looks."
      >
        <Stack gap={4}>
          <Heading level={2} size="display-lg" highlight="shaped by flow">
            Objects shaped by flow
          </Heading>
          <Heading level={3} size="display-sm">
            A smaller heading, still a real h3
          </Heading>
        </Stack>
      </Specimen>

      <Specimen name="Text / Eyebrow">
        <Stack gap={3}>
          <Eyebrow>Selected works</Eyebrow>
          <Text size="lg">
            Collectible furniture, sculptural resin objects and large-format commissions.
          </Text>
          <Text size="base" tone="secondary">
            Supporting copy in the secondary ink tone.
          </Text>
          <Text size="sm" tone="tertiary">
            Metadata and captions sit at tertiary.
          </Text>
        </Stack>
      </Specimen>

      <Specimen name="Badge / Tag / Divider">
        <Cluster gap={3} align="center">
          <Badge tone="success">Published</Badge>
          <Badge tone="warning">Review</Badge>
          <Badge tone="danger">Error</Badge>
          <Badge tone="info">Draft</Badge>
          <Tag>Resin</Tag>
          <Tag>Walnut</Tag>
        </Cluster>
        <div className="w-full">
          <Divider />
        </div>
      </Specimen>

      <Specimen
        name="Surface"
        note="Elevation is a lifted surface on DEEP/INK and a shadow on BONE — the component does not test which."
      >
        <Cluster gap={4}>
          <Surface level={0} className="p-4">
            <Text size="sm">level 0</Text>
          </Surface>
          <Surface level={1} className="p-4">
            <Text size="sm">level 1</Text>
          </Surface>
          <Surface level={2} className="p-4">
            <Text size="sm">level 2</Text>
          </Surface>
          <Surface level={3} className="p-4">
            <Text size="sm">level 3</Text>
          </Surface>
        </Cluster>
      </Specimen>

      <Specimen name="Grid" note="4 / 8 / 12 columns by viewport (§5.4).">
        <Grid className="w-full">
          {[1, 2, 3, 4].map((n) => (
            <Surface key={n} level={1} className="p-4">
              <Text size="sm">{`cell ${n}`}</Text>
            </Surface>
          ))}
        </Grid>
      </Specimen>

      <Specimen
        name="AspectBox / MediaFrame / Skeleton"
        note="Ratios reserve space so media cannot spend the CLS budget."
      >
        <div className="w-64">
          <AspectBox ratio="16:9" mobileRatio="4:5">
            <Skeleton className="size-full" />
          </AspectBox>
        </div>
        <div className="w-64">
          <MediaFrame ratio="3:2" fallbackLabel="Image temporarily unavailable" />
        </div>
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
