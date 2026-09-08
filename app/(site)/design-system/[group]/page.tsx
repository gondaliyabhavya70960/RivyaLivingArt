'use client'

import * as React from 'react'
import { notFound } from 'next/navigation'
import { use } from 'react'
import { Specimen, State } from '@/components/devtools/Specimen'
import { Button } from '@/components/primitives/Button'
import { Text } from '@/components/primitives/Text'
import { Stack } from '@/components/primitives/Stack'
import { Cluster } from '@/components/primitives/Cluster'
import { TextLink } from '@/components/primitives/TextLink'
import { Dialog } from '@/components/patterns/Dialog'
import { Drawer } from '@/components/patterns/Drawer'
import { Tooltip } from '@/components/patterns/Tooltip'
import { Tabs } from '@/components/patterns/Tabs'
import { Accordion } from '@/components/patterns/Accordion'
import { Disclosure } from '@/components/patterns/Disclosure'
import { DropdownMenu } from '@/components/patterns/DropdownMenu'

/**
 * The behavioural patterns, at /design-system/patterns.
 *
 * This is the surface the Phase 02 keyboard verification is performed against: Dialog traps
 * and restores focus, Tabs follow a roving tabindex, Accordion headers are buttons,
 * DropdownMenu opens on Enter/Space/ArrowDown and closes on Escape returning focus to its
 * trigger. Every one of those needs a live instance to press keys against, which is why the
 * page is a Client Component while the primitives index is not.
 *
 * Dev-only by the same explicit guard as the index page.
 */
export default function PatternsPage({ params }: { params: Promise<{ group: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()

  const { group } = use(params)
  if (group !== 'patterns') notFound()

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [lastChoice, setLastChoice] = React.useState('none')

  return (
    <main className="mx-auto max-w-(--rv-container-wide) px-(--rv-gutter) py-16">
      <h1 className="font-display text-display-lg text-ink leading-heading tracking-heading">
        Behavioural patterns
      </h1>
      <p className="text-ink-secondary mt-3 max-w-(--rv-container-prose) text-lg">
        Keyboard-complete and focus-managed. Development build only.
      </p>
      <nav className="mt-6" aria-label="Design system sections">
        <TextLink href="/design-system">Back to primitives</TextLink>
      </nav>

      <Specimen
        name="Dialog"
        note="Traps focus, restores it to the trigger on close, Escape closes."
      >
        <State label="modal">
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Discard this draft?"
            description="The draft has unsaved changes."
            closeLabel="Close"
          >
            <Cluster gap={3}>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Keep editing
              </Button>
              <Button variant="danger" onClick={() => setDialogOpen(false)}>
                Discard
              </Button>
            </Cluster>
          </Dialog>
        </State>
      </Specimen>

      <Specimen name="Drawer" note="Same modal semantics, edge-anchored.">
        <State label="right">
          <Button onClick={() => setDrawerOpen(true)}>Open drawer</Button>
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            side="right"
            title="Filters"
            closeLabel="Close"
          >
            <Text size="sm">Filter controls would sit here.</Text>
          </Drawer>
        </State>
      </Specimen>

      <Specimen
        name="Tooltip"
        note="Supplements the accessible name, never replaces it. Escape dismisses (WCAG 1.4.13)."
      >
        <State label="on a button">
          <Tooltip content="Publishing makes this collection visible on the public site.">
            <Button variant="secondary">Publish</Button>
          </Tooltip>
        </State>
      </Specimen>

      <Specimen name="Tabs" note="Roving tabindex; arrows move, Enter/Space activates.">
        <div className="w-full">
          <Tabs
            label="Product information"
            items={[
              {
                id: 'overview',
                label: 'Overview',
                content: <Text size="sm">Overview panel.</Text>,
              },
              {
                id: 'materials',
                label: 'Materials',
                content: <Text size="sm">Materials panel.</Text>,
              },
              { id: 'care', label: 'Care', content: <Text size="sm">Care panel.</Text> },
            ]}
          />
        </div>
      </Specimen>

      <Specimen name="Accordion" note="Every header is a real button with aria-expanded.">
        <div className="w-full">
          <Accordion
            headingLevel={3}
            mode="multiple"
            items={[
              {
                id: 'a',
                header: 'Do you make custom-size furniture?',
                content: <Text size="sm">Answer A.</Text>,
              },
              {
                id: 'b',
                header: 'Can I choose the resin colour?',
                content: <Text size="sm">Answer B.</Text>,
              },
            ]}
          />
        </div>
      </Specimen>

      <Specimen name="Disclosure" note="The minimal show/hide: one button, one region.">
        <div className="w-full">
          <Disclosure label="Delivery and installation">
            <Text size="sm">Disclosure content.</Text>
          </Disclosure>
        </div>
      </Specimen>

      <Specimen
        name="DropdownMenu"
        note="Opens on Enter, Space and ArrowDown; Escape closes and restores focus to the trigger."
      >
        <Stack gap={3}>
          <DropdownMenu
            trigger={<Button variant="secondary">Row actions</Button>}
            items={[
              { id: 'edit', label: 'Edit', onSelect: () => setLastChoice('Edit') },
              { id: 'duplicate', label: 'Duplicate', onSelect: () => setLastChoice('Duplicate') },
              {
                id: 'archive',
                label: 'Archive',
                onSelect: () => setLastChoice('Archive'),
                disabled: true,
              },
            ]}
          />
          <Text size="sm" tone="tertiary">{`Last choice: ${lastChoice}`}</Text>
        </Stack>
      </Specimen>
    </main>
  )
}
