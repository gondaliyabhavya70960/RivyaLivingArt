#!/usr/bin/env node
/**
 * The Studio's front door is a file convention, and file conventions fail silently.
 *
 * Next 16 renamed `middleware.ts` to `proxy.ts` (amendment A6). The failure this guards against is
 * not a deprecation warning — it is that Next does not look for `middleware.ts` any more, and does
 * not complain about a file it was never going to read. A `proxy.ts` restored from an older
 * document, a stale branch, or a half-run codemod therefore leaves every Studio route reachable
 * without a session, with a green build and no warning anywhere.
 *
 * tests/e2e/studio-access.spec.ts proves the redirect actually happens, which is the real check.
 * This one is here because it runs in a second without a browser or a server, so the regression is
 * caught by `npm run lint`-speed feedback rather than at the end of an e2e run.
 *
 * It deliberately does NOT try to prove the matcher covers the Studio. A regex reimplemented here
 * would be a second source of truth that can drift from the first while both look correct; the
 * e2e spec walks six real Studio paths instead.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const failures = []

// Every place Next would accept the deprecated convention.
for (const stale of ['middleware.ts', 'middleware.js', 'src/middleware.ts', 'src/middleware.js']) {
  if (existsSync(join(root, stale))) {
    failures.push(
      `${stale} exists. Next 16 no longer reads this file (amendment A6) — it is dead code that ` +
        `looks like the Studio's auth redirect. Move its contents into proxy.ts.`,
    )
  }
}

const proxyPath = ['proxy.ts', 'src/proxy.ts'].map((p) => join(root, p)).find(existsSync)

if (!proxyPath) {
  failures.push(
    'No proxy.ts. Without it nothing redirects an unauthenticated request away from /studio.',
  )
} else {
  const source = readFileSync(proxyPath, 'utf8')

  // Next accepts a default export or one named `proxy`, and nothing else. An export still named
  // `middleware` is the exact shape a partial rename leaves behind.
  const hasNamed = /export\s+(?:async\s+)?function\s+proxy\s*\(/.test(source)
  const hasDefault = /export\s+default\s/.test(source)
  if (!hasNamed && !hasDefault) {
    failures.push(
      `${proxyPath} exports no \`proxy\` function and no default export, so Next runs nothing.`,
    )
  }
  if (/export\s+(?:async\s+)?function\s+middleware\s*\(/.test(source)) {
    failures.push(`${proxyPath} still exports \`middleware\`. Next 16 will not call it.`)
  }
  if (!/export\s+const\s+config\s*=/.test(source)) {
    failures.push(
      `${proxyPath} exports no \`config\`, so it runs on EVERY request including static assets.`,
    )
  }
}

if (failures.length > 0) {
  console.error('proxy convention check failed:\n')
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  console.error('')
  process.exit(1)
}

console.log('✓ proxy convention intact')
