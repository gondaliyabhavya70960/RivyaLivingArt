import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'

/**
 * A heading and its actions, aligned.
 *
 * Separate from `StudioPage` because sub-sections need the same alignment without a second `h1`:
 * `level` is required rather than defaulted so a caller has to decide, which is what stops a page
 * accumulating three `h1`s as panels are added. A screen-reader user navigating by heading is the
 * one who pays for that mistake.
 */
export function PageHeader({
  level,
  title,
  description,
  actions,
}: {
  level: 1 | 2 | 3
  /** Resolved copy. Never a literal at the call site. */
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <Stack gap={1} className="max-w-prose">
        <Heading level={level} size={level === 1 ? 'display-md' : 'display-xs'}>
          {title}
        </Heading>
        {description !== undefined && <Text tone="secondary">{description}</Text>}
      </Stack>
      {actions}
    </div>
  )
}

/**
 * A row of controls.
 *
 * `role="toolbar"` is deliberately NOT set. It brings a keyboard contract with it — arrow keys move
 * between controls and Tab leaves the group — and a bar of ordinary buttons that claims the role
 * without implementing it is worse for a keyboard user than a plain `div`, because their arrow keys
 * stop doing what the rest of the page taught them.
 */
export function Toolbar({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div aria-label={label} className="flex flex-wrap items-center gap-2">
      {children}
    </div>
  )
}
