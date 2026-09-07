import { compile } from 'tailwindcss'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
const ROOT = '/home/user/RivyaLivingArt'
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
const list = ['*:size-5','size-13','size-11','size-9','duration-[--rv-duration-fast]','duration-(--rv-duration-fast)','decoration-1','hover:decoration-2','ease-standard','transition-[color,background-color,border-color]','transition-[text-decoration-thickness]','text-ink-tertiary','hidden','sm:flex','ms-1','align-baseline','font-medium','rounded-sm','shrink-0']
for (const c of list) {
  const css = compiler.build([c])
  console.log('---', c, '\n', css.replace(/@layer[^{]*\{/g,'').trim().slice(0,300))
}
