import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)))
const root = lock.packages['']
const emittersHtml = lock.packages['node_modules/@kindly-note/emitters-html']
const emittersMarkdown = lock.packages['node_modules/@kindly-note/emitters-markdown']
const renderMarkdown = lock.packages['node_modules/@kindly-note/render-markdown']

function requireEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} changed: expected ${expected}, found ${actual}`)
}

requireEqual(root.devDependencies['@kindly-note/core'], manifest.devDependencies['@kindly-note/core'], 'root core development range')
requireEqual(emittersHtml.peerDependencies['@kindly-note/core'], '^0.1.0', 'published emitters-html core peer range')
requireEqual(emittersMarkdown.peerDependencies['@kindly-note/core'], '^0.2.0', 'published emitters-markdown core peer range')
requireEqual(emittersMarkdown.dependencies['@kindly-note/emitters-html'], '^0.1.0', 'published emitters-markdown HTML emitter range')
requireEqual(renderMarkdown.version, '0.1.0', 'published render-markdown version')

console.log(
  'peer constraint recorded: root core ^0.2.0 and published emitters-html 0.1.0 requires core ^0.1.0; '
  + 'the repository install therefore requires the documented legacy resolver, while consumer installs remain normal',
)
