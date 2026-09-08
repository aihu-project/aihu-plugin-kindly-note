import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const archive = process.argv[2]
if (!archive) throw new Error('usage: node scripts/consumer-smoke.mjs /absolute/path/package.tgz')
const dir = mkdtempSync(join(tmpdir(), 'aihu-plugin-kindly-note-consumer-'))
execFileSync('npm', ['init', '-y'], { cwd: dir, stdio: 'ignore' })
execFileSync('npm', ['install', '--ignore-scripts', resolve(archive)], { cwd: dir, stdio: 'inherit' })
execFileSync('node', ['--input-type=module', '-e', `
  const mod = await import('@aihu-plugin/kindly-note')
  for (const name of ['kindlyNote', 'highlight', 'renderMarkdown', 'defineCodeElement', 'defineMarkdownElement']) {
    if (typeof mod[name] !== 'function') throw new Error('missing public export: ' + name)
  }
  const fallback = await mod.highlight('a < b', 'consumer-smoke-unknown-language')
  if (!fallback.fallback || fallback.html !== 'a &lt; b') throw new Error('fallback runtime contract failed')
  if (mod.kindlyNote().name !== 'kindly-note') throw new Error('plugin registration contract failed')
`], { cwd: dir, stdio: 'inherit' })
console.log(`isolated consumer passed in ${dir}`)
