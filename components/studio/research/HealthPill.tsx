import { Badge } from '@/components/primitives/Badge'
import { Text } from '@/components/primitives/Text'

/**
 * One source's derived health, as a pill.
 *
 * FIVE STATES AND A SIXTH THAT IS NOT ONE. `null` means the view returned no row for this source,
 * which happens only in the moment between a source being created and the read that follows — and
 * it renders as an em dash rather than as `HEALTHY`. Defaulting an unknown to the reassuring value
 * is how a dashboard comes to say everything is fine because it could not find out.
 *
 * THE TONES ARE NOT A TRAFFIC LIGHT. `DISABLED` is neutral because a source somebody switched off
 * is not a problem; `STALE` is a warning rather than a failure because nothing has gone wrong, it
 * has simply not happened. Only `FAILING` is danger, so that the one state needing attention is
 * the one that looks like it.
 */
export function HealthPill({ health }: { readonly health: string | null }) {
  if (health === null) {
    return (
      <Text size="sm" tone="tertiary">
        —
      </Text>
    )
  }

  const tone =
    health === 'FAILING'
      ? 'danger'
      : health === 'DEGRADED' || health === 'STALE'
        ? 'warning'
        : health === 'HEALTHY'
          ? 'success'
          : 'neutral'

  return <Badge tone={tone}>{health}</Badge>
}
