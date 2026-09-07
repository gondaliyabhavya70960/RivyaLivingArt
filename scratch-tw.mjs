import { compile } from 'tailwindcss'
import { readFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
const ROOT = process.cwd()
const TW = resolve(ROOT, 'node_modules/tailwindcss')
function loadStylesheet(id, base) {
  let path
  if (id === 'tailwindcss') path = resolve(TW, 'index.css')
  else if (id.startsWith('tailwindcss/')) path = resolve(TW, id.slice('tailwindcss/'.length))
  else path = resolve(base, id)
  return { path, base: dirname(path), content: readFileSync(path, 'utf8') }
}
const compiler = await compile(readFileSync(resolve(ROOT, 'app/globals.css'), 'utf8'), {
  base: resolve(ROOT, 'app'),
  loadStylesheet: async (id, base) => loadStylesheet(id, base),
  loadModule: async () => { throw new Error('no js plugins') },
})
const list = process.argv.slice(2)
console.log(compiler.build(list))
