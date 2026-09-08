import { Text } from '@/components/primitives/Text'

/**
 * A timestamp a person can read, without lying about precision.
 *
 * IT RENDERS ON THE SERVER AND DOES NOT TICK. "3 minutes ago" computed at render and never updated
 * is wrong within a minute, and a component that silently drifts is worse than one that never
 * claimed to be live — so anything under an hour reads "just now" rather than a number that will
 * quietly become false while the page sits open.
 *
 * THE EXACT INSTANT IS ALWAYS AVAILABLE. `<time datetime>` carries the machine value and `title`
 * carries the full local rendering, so "yesterday" can always be resolved to a moment — which is
 * what anybody investigating an incident actually needs.
 *
 * IST, because the business is in India and every person reading this is too. Hard-coded rather
 * than read from the browser: this is a Server Component, so there is no browser to ask, and
 * guessing UTC would put every timestamp five and a half hours out for every reader.
 */
const ZONE = 'Asia/Kolkata'

const FULL = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: ZONE,
})

const DAY = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: ZONE })

export function RelativeTime({ value, now = new Date() }: { value: string; now?: Date }) {
  const when = new Date(value)
  if (Number.isNaN(when.getTime())) {
    // An unparseable timestamp is a data problem, and showing "Invalid Date" tells the reader
    // nothing. Show the raw value so it can be reported.
    return (
      <Text as="span" size="xs" tone="tertiary">
        {value}
      </Text>
    )
  }

  const full = FULL.format(when)
  const elapsed = now.getTime() - when.getTime()
  const hours = elapsed / 3_600_000

  let label: string
  if (hours < 0)
    label = full // A future timestamp is not "in 2 hours", it is a clock problem.
  else if (hours < 1) label = 'Just now'
  else if (hours < 24) label = `${Math.floor(hours)}h ago`
  else if (hours < 24 * 7) label = `${Math.floor(hours / 24)}d ago`
  else label = DAY.format(when)

  return (
    <Text as="span" size="xs" tone="tertiary">
      <time dateTime={value} title={full}>
        {label}
      </time>
    </Text>
  )
}
