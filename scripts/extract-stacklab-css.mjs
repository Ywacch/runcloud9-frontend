import fs from 'node:fs'

const html = fs.readFileSync(new URL('../../UI pages/components.html', import.meta.url), 'utf8')
const start = html.indexOf('<style>')
const end = html.indexOf('</style>')
if (start < 0 || end < 0) throw new Error('style block missing')
let css = html.slice(start + 7, end)
css = css.replace(':root{', '.sl-inspector{')

const out = []
let i = 0
while (i < css.length) {
  while (i < css.length && /\s/.test(css[i])) i++
  if (i >= css.length) break
  if (css.startsWith('@keyframes', i) || css.startsWith('@media', i)) {
    let depth = 0
    let j = i
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') {
        depth--
        if (depth === 0) {
          j++
          break
        }
      }
    }
    out.push(css.slice(i, j))
    i = j
    continue
  }
  const brace = css.indexOf('{', i)
  if (brace < 0) break
  const sel = css.slice(i, brace).trim()
  let depth = 0
  let j = brace
  for (; j < css.length; j++) {
    if (css[j] === '{') depth++
    else if (css[j] === '}') {
      depth--
      if (depth === 0) {
        j++
        break
      }
    }
  }
  const body = css.slice(brace, j)
  if (!sel) {
    i = j
    continue
  }
  const prefixed = sel
    .split(',')
    .map((s) => {
      const t = s.trim()
      if (!t || t.startsWith('.sl-inspector')) return t
      return `.sl-inspector ${t}`
    })
    .join(',')
  out.push(prefixed + body)
  i = j
}

const header =
  '/* Verbatim inspector CSS from UI pages/components.html, scoped under .sl-inspector */\n' +
  '/* RunCloud9: surfaces use a slight indigo tint vs StackLab mock */\n'
const file = header + out.join('\n') + '\n'
fs.writeFileSync(new URL('../src/editor-ui/stacklabInspector.css', import.meta.url), file)
console.log('wrote', file.length)
