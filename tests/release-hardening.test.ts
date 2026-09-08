import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const oidcScript = join(root, 'scripts/check-oidc-auth.mjs')

function isolatedEnv() {
  const dir = mkdtempSync(join(tmpdir(), 'kindly-note-auth-test-'))
  const project = join(dir, 'project.npmrc')
  const user = join(dir, 'user.npmrc')
  const global = join(dir, 'global.npmrc')
  for (const file of [project, user, global]) writeFileSync(file, '')
  return {
    dir,
    project,
    user,
    global,
    env: {
      ...process.env,
      NPM_CONFIG_PROJECTCONFIG: project,
      NPM_CONFIG_USERCONFIG: user,
      NPM_CONFIG_GLOBALCONFIG: global,
    },
  }
}

function runGate(env: NodeJS.ProcessEnv) {
  try {
    return {
      ok: true,
      output: execFileSync(process.execPath, [oidcScript], {
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    }
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string }
    return { ok: false, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` }
  }
}

describe('OIDC release gate', () => {
  it.each([
    ['_authToken', 'project'],
    ['_auth', 'user'],
    ['_auth-token', 'global'],
  ])('rejects %s in the %s npmrc without exposing its value', (key, source) => {
    const files = isolatedEnv()
    const file = files[source as 'project' | 'user' | 'global']
    const secret = 'super-secret-regression-token'
    writeFileSync(file, `//registry.npmjs.org/:${key}=${secret}\n`)

    const result = runGate(files.env)
    expect(result.ok).toBe(false)
    expect(result.output).toContain('classic npm auth setting')
    expect(result.output).not.toContain(secret)
  })

  it('rejects the default user npmrc when NPM_CONFIG_USERCONFIG is unset', () => {
    const files = isolatedEnv()
    const home = join(files.dir, 'home')
    const defaultUser = join(home, '.npmrc')
    mkdirSync(home)
    writeFileSync(defaultUser, '//registry.npmjs.org/:_auth=super-secret-regression-token\n')
    const { NPM_CONFIG_USERCONFIG: _ignored, ...withoutUserConfig } = files.env
    const env = { ...withoutUserConfig, HOME: home }

    const result = runGate(env)
    expect(result.ok).toBe(false)
    expect(result.output).toContain(defaultUser)
    expect(result.output).not.toContain('super-secret-regression-token')
  })

  it.each(['NPM_CONFIG_REGISTRY_AUTHTOKEN', 'NPM_CONFIG_REGISTRY_AUTH', 'NPM_CONFIG_REGISTRY_AUTH-TOKEN'])(
    'rejects %s environment configuration',
    (name) => {
      const files = isolatedEnv()
      const result = runGate({ ...files.env, [name]: 'super-secret-regression-token' })
      expect(result.ok).toBe(false)
      expect(result.output).toContain(`${name} must be empty`)
      expect(result.output).not.toContain('super-secret-regression-token')
    },
  )
})

describe('release package contract', () => {
  it('records the upstream peer conflict separately from consumer installation', () => {
    const output = execFileSync(process.execPath, ['scripts/check-peer-constraints.mjs'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(output).toContain('emitters-html 0.1.0 requires core ^0.1.0')
    expect(output).toContain('consumer installs remain normal')
  })

  it('verifies the exact seven-file tarball and its export targets', () => {
    const output = execFileSync(process.execPath, ['scripts/verify-pack.mjs'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(output).toContain('(7 files)')
  })

  it('rejects a file injected into the published dist directory', () => {
    const packRoot = mkdtempSync(join(tmpdir(), 'kindly-note-pack-test-'))
    mkdirSync(join(packRoot, 'dist'))
    mkdirSync(join(packRoot, 'scripts'))
    for (const file of ['package.json', 'README.md', 'LICENSE']) {
      cpSync(join(root, file), join(packRoot, file))
    }
    for (const file of ['index.js', 'index.js.map', 'index.d.ts', 'index.d.ts.map']) {
      cpSync(join(root, 'dist', file), join(packRoot, 'dist', file))
    }
    cpSync(join(root, 'scripts/verify-pack.mjs'), join(packRoot, 'scripts/verify-pack.mjs'))
    writeFileSync(join(packRoot, 'dist/injected.js'), 'export const injected = true\n')

    try {
      execFileSync(process.execPath, [join(packRoot, 'scripts/verify-pack.mjs')], {
        cwd: packRoot,
        env: { ...process.env, PACK_ROOT: packRoot },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      throw new Error('verify-pack unexpectedly accepted an injected file')
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string; status?: number }
      expect(failure.status).not.toBe(0)
      expect(`${failure.stdout ?? ''}${failure.stderr ?? ''}`).toContain('package/dist/injected.js')
    }
  })
})
