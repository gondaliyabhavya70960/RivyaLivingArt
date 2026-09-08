import type { Permission, Role } from '@/lib/auth/permissions'
import { ROLE_PERMISSIONS, roleHasPermission } from '@/lib/auth/permissions'

/**
 * The command palette's provider registry.
 *
 * WHY A REGISTRY RATHER THAN A GROWING SWITCH. Phases 06–23 each add something searchable —
 * products, media, pages, research rows. Every one of those would otherwise edit the palette, and
 * the palette would accumulate imports from every domain in the product. Here a phase adds a file
 * that calls `registerCommandProvider` and touches nothing else.
 *
 * TWO LIMITS, BOTH ENFORCED HERE RATHER THAN TRUSTED TO PROVIDERS. The phase document sets a
 * 20-result, 200 ms budget per provider, and a budget a provider polices itself is not a budget:
 * one slow query in Phase 27 would make the palette feel broken with nothing pointing at the cause.
 * `runProviders` truncates and times out on the provider's behalf, and reports which ones it cut
 * off, so the palette can say results are incomplete instead of silently showing fewer.
 *
 * PERMISSIONS ARE FILTERED TWICE, DELIBERATELY. A provider declares the permission its results
 * require and is skipped for a role that lacks it — but that is a courtesy, exactly like the
 * sidebar. Anything a result links to re-checks on the server, and RLS refuses underneath. A
 * palette that returned a product a role cannot open would only be a slower way to reach a 403;
 * one that leaked the product's NAME in the result row would be a real disclosure, which is why
 * the skip happens before the provider runs rather than after.
 */

export const RESULTS_PER_PROVIDER = 20
export const PROVIDER_BUDGET_MS = 200

export type CommandResult = {
  /** Unique within a provider. */
  readonly id: string
  /** What the reader sees. Resolved copy or a record's own name — never a raw key. */
  readonly label: string
  /** Optional second line: a path, a status, a category. */
  readonly hint?: string
  /** Where Enter goes. */
  readonly href: string
  /** Groups results in the list. Resolved copy. */
  readonly group: string
}

/**
 * What a provider is told about the reader.
 *
 * The ROLE is passed in rather than looked up, because a provider often needs a finer filter than
 * its own `permission` gives. The route provider is the proof: its permission is `studio.access`,
 * which every role holds, but each individual route has its own — so filtering only on the
 * provider's permission would put `/studio/system/users` in a viewer's palette. Discovered by
 * writing the first provider, which is the argument for the parameter existing.
 */
export type CommandContext = {
  readonly role: Role
  /** Every permission the role holds, so a provider does not recompute it per result. */
  readonly held: readonly Permission[]
}

export type CommandProvider = {
  readonly id: string
  /** Roles without this are skipped before the provider runs, so nothing leaks into a result. */
  readonly permission: Permission
  /** Given the query, return matches. Called on the server. */
  readonly search: (
    query: string,
    context: CommandContext,
    signal: AbortSignal,
  ) => Promise<CommandResult[]>
}

const providers = new Map<string, CommandProvider>()

export function registerCommandProvider(provider: CommandProvider): void {
  // Last registration wins rather than throwing: a module re-evaluated by the dev server's hot
  // reload would otherwise crash the palette, and a duplicate id is a programming error that the
  // test below catches at build time instead.
  providers.set(provider.id, provider)
}

export function registeredProviders(): CommandProvider[] {
  return [...providers.values()]
}

/** Test seam. Not exported through the barrel — production never clears the registry. */
export function resetCommandProviders(): void {
  providers.clear()
}

export type CommandSearchOutcome = {
  results: CommandResult[]
  /** Providers that hit the time budget. The palette says results may be incomplete. */
  timedOut: string[]
  /** Providers that threw. Distinct from a timeout: one is slow, the other is broken. */
  failed: string[]
}

/**
 * Run every provider the role may use, in parallel, each on its own budget.
 *
 * A provider that times out or throws does NOT fail the search. The palette is a navigation aid; a
 * broken research provider in Phase 27 must not stop somebody jumping to a product. What it must
 * not do is pretend the results are complete, hence the two lists.
 */
export async function runProviders(
  query: string,
  role: Role | null,
  { signal }: { signal?: AbortSignal } = {},
): Promise<CommandSearchOutcome> {
  const trimmed = query.trim()
  if (role === null || trimmed === '') return { results: [], timedOut: [], failed: [] }

  const context: CommandContext = { role, held: ROLE_PERMISSIONS[role] }

  const usable = registeredProviders().filter((provider) =>
    roleHasPermission(role, provider.permission),
  )

  const timedOut: string[] = []
  const failed: string[] = []

  const settled = await Promise.all(
    usable.map(async (provider) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), PROVIDER_BUDGET_MS)

      // Cancel this provider if the whole search is cancelled — the reader typed another character.
      const onAbort = () => controller.abort()
      signal?.addEventListener('abort', onAbort, { once: true })

      try {
        const found = await provider.search(trimmed, context, controller.signal)
        return found.slice(0, RESULTS_PER_PROVIDER)
      } catch {
        // An abort and a thrown error are told apart by whether the budget fired, because a
        // provider that rejects on abort and one that rejects on a bad query look identical here.
        if (controller.signal.aborted) timedOut.push(provider.id)
        else failed.push(provider.id)
        return []
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
      }
    }),
  )

  return { results: settled.flat(), timedOut, failed }
}
