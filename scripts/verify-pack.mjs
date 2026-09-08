import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = new URL('..', import.meta.url)
const rootPath = resolve(process.env.PACK_ROOT ?? root.pathname)
const packDir = resolve(rootPath, process.env.PACK_DIR ?? '.release')
mkdirSync(packDir, { recursive: true })
for (const entry of readdirSync(packDir)) rmSync(resolve(packDir, entry), { recursive: true, force: true })
const manifest = JSON.parse(readFileSync(resolve(rootPath, 'package.json')))
const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', packDir], {
  cwd: rootPath,
  encoding: 'utf8',
}))[0]
const archivePath = resolve(packDir, packed.filename)
const fail = (message) => { throw new Error(`packed package check failed: ${message}`) }
if (!existsSync(archivePath)) fail(`npm pack did not create ${archivePath}`)
const archives = readdirSync(packDir).filter((entry) => entry.endsWith('.tgz'))
if (archives.length !== 1 || archives[0] !== packed.filename) fail(`expected exactly one captured tarball in ${packDir}`)

const expectedFilename = `${manifest.name.slice(1).replace('/', '-')}-${manifest.version}.tgz`
if (packed.filename !== expectedFilename) fail(`archive ${packed.filename} is not ${expectedFilename}`)
const packedManifest = JSON.parse(execFileSync('tar', ['-xOf', archivePath, 'package/package.json'], { encoding: 'utf8' }))
if (packedManifest.name !== manifest.name) fail(`name ${packedManifest.name} != ${manifest.name}`)
if (packedManifest.version !== manifest.version) fail(`version ${packedManifest.version} != ${manifest.version}`)
for (const field of ['main', 'module', 'types']) {
  if (packedManifest[field] !== manifest[field]) fail(`${field} changed in tarball`)
}
for (const field of ['exports', 'files', 'sideEffects']) {
  if (JSON.stringify(packedManifest[field]) !== JSON.stringify(manifest[field])) fail(`${field} changed in tarball`)
}
if (JSON.stringify(packedManifest.dependencies) !== JSON.stringify(manifest.dependencies)) fail('dependencies changed in tarball')
if (JSON.stringify(packedManifest.peerDependencies) !== JSON.stringify(manifest.peerDependencies)) fail('peer dependencies changed in tarball')
if (JSON.stringify(packedManifest).includes('workspace:')) fail('workspace dependency leaked into tarball')

const entries = execFileSync('tar', ['-tzf', archivePath], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean)
  .sort()
const expectedEntries = [
  'package/LICENSE',
  'package/README.md',
  'package/dist/index.d.ts',
  'package/dist/index.d.ts.map',
  'package/dist/index.js',
  'package/dist/index.js.map',
  'package/package.json',
]
if (JSON.stringify(entries) !== JSON.stringify(expectedEntries)) {
  const added = entries.filter((entry) => !expectedEntries.includes(entry))
  const missing = expectedEntries.filter((entry) => !entries.includes(entry))
  fail(`tarball contents differ (added: ${added.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'})`)
}

function exportTargets(value, path = 'exports') {
  if (typeof value === 'string') return [[path, value]]
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => exportTargets(child, `${path}.${key}`))
}

for (const [path, target] of exportTargets(packedManifest.exports)) {
  if (!target.startsWith('./')) fail(`${path} must be a relative package export`)
  if (!entries.includes(`package/${target.slice(2)}`)) fail(`${path} points to missing ${target}`)
}
for (const field of ['main', 'module', 'types']) {
  const target = packedManifest[field]
  if (!target.startsWith('./') || !entries.includes(`package/${target.slice(2)}`)) {
    fail(`${field} points to missing ${target}`)
  }
}

if (process.env.GITHUB_ENV) writeFileSync(process.env.GITHUB_ENV, `AIHU_PACK_PATH=${archivePath}\n`, { flag: 'a' })
console.log(`verified ${archivePath}: ${packedManifest.name}@${packedManifest.version} (${entries.length} files)`)
