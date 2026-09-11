#!/usr/bin/env node
/**
 * seo:check-jsonld-scope — fails the build when anything but components/patterns/JsonLd emits
 * `application/ld+json`. See jsonld-scope.mjs for the rule.
 */
import { EMITTER, findJsonLdEmitters } from './jsonld-scope.mjs'

const found = findJsonLdEmitters(process.cwd())
if (found.length > 0) {
  console.error('\n✗ a second JSON-LD emitter:\n')
  for (const entry of found) console.error(`    ${entry}`)
  console.error(
    `\n  ${EMITTER} is the only file that may write a structured-data script element.\n` +
      '  Every builder in lib/seo/jsonld/ returns an object; the route collects the survivors into\n' +
      '  one graph and hands it to <JsonLd />. A second emitter is a second place a forbidden key\n' +
      '  could reach a crawler without passing forbiddenKeysIn().\n',
  )
  process.exit(1)
}
console.log(`✓ structured data: ${EMITTER} is the only application/ld+json emitter`)
