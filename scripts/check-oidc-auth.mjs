import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const rootPath = resolve(new URL('..', import.meta.url).pathname)
const authKey = /(?:_authToken|_auth-token|_auth)$/i

function isAuthKey(key) {
  return authKey.test(key.trim())
}

function configPaths() {
  const home = process.env.HOME || process.env.USERPROFILE || homedir()
  const userConfig = process.env.NPM_CONFIG_USERCONFIG || join(home, '.npmrc')
  const globalConfig = process.env.NPM_CONFIG_GLOBALCONFIG
    || join(process.env.NPM_CONFIG_PREFIX || dirname(dirname(process.execPath)), 'etc', 'npmrc')
  const paths = [
    process.env.NPM_CONFIG_PROJECTCONFIG || join(rootPath, '.npmrc'),
    userConfig,
    globalConfig,
  ]
  return [...new Set(paths.filter(Boolean).map((file) => resolve(file)))]
}

function checkEnvironment() {
  for (const [name, value] of Object.entries(process.env)) {
    if (!value) continue
    const upperName = name.toUpperCase()
    if (upperName === 'NPM_TOKEN' || upperName === 'NODE_AUTH_TOKEN') {
      throw new Error(`${name} must be empty; npm trusted publishing uses GitHub OIDC`)
    }
    if (upperName.startsWith('NPM_CONFIG_') && isAuthKey(name.slice('NPM_CONFIG_'.length))) {
      throw new Error(`${name} must be empty; npm trusted publishing uses GitHub OIDC`)
    }
  }
}

function checkConfig(file) {
  if (!existsSync(file)) return
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue
    const match = trimmed.match(/^([^=]+?)\s*=\s*(.*)$/)
    if (!match || !isAuthKey(match[1])) continue
    // Never include the value in diagnostics: npmrc files commonly contain a
    // bearer token or base64 basic-auth credential.
    throw new Error(`classic npm auth setting ${match[1].trim()} found in ${file}:${index + 1}; trusted publishing requires OIDC`)
  }
}

checkEnvironment()
for (const file of configPaths()) checkConfig(file)

console.log('classic npm auth checks passed; release may use npm trusted publishing')
